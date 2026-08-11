import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { GenerationPipeline } from '../../generation/pipeline.js';
import { RAGRetriever } from '../../rag/retriever.js';
import * as projectRepo from '../../db/repositories/project-repo.js';
import * as artifactRepo from '../../db/repositories/artifact-repo.js';
import { createLLMClient, createEmbeddingClient } from '../../llm/factory.js';
import type { LLMClient } from '../../llm/interface.js';
import { config } from '../../config/index.js';
import { getPool } from '../../db/connection.js';
import { loadPrompts } from '../../prompts/loader.js';
import { createChildLogger } from '../../logger.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Specification, ArchitectureDocument } from '../../generation/schemas.js';
import {
  TelemetryService,
  GenerationTracker,
  CloudWatchSink,
  toGenerationRecord,
  failureRecord,
  type RecordGenerationOptions,
} from '../../telemetry/index.js';

const log = createChildLogger('generation-api');
const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// Lazy-initialize pipeline (created on first request to avoid startup dependency)
let pipeline: GenerationPipeline | null = null;
let retriever: RAGRetriever | null = null;
let telemetry: TelemetryService | null = null;
let llmClient: LLMClient | null = null;
let embeddingClient: LLMClient | null = null;

function getTelemetry(): TelemetryService {
  if (!telemetry) {
    telemetry = new TelemetryService(
      new GenerationTracker(getPool()),
      new CloudWatchSink({
        enabled: config.cloudwatchEnabled,
        region: config.cloudwatchRegion,
        namespace: config.cloudwatchNamespace,
      }),
    );
  }
  return telemetry;
}

function recordSuccess(opts: RecordGenerationOptions): void {
  getTelemetry().record(toGenerationRecord(opts));
}

function recordFailure(module: string, errorCategory: string): void {
  getTelemetry().record(
    failureRecord({
      module,
      provider: config.llmProvider,
      model: config.llmModel,
      errorCategory,
    }),
  );
}

export function getLLMClient(): LLMClient {
  if (!llmClient) {
    llmClient = createLLMClient(config);
  }
  return llmClient;
}

export function getEmbeddingClient(): LLMClient {
  if (!embeddingClient) {
    embeddingClient = createEmbeddingClient(config);
  }
  return embeddingClient;
}

function getPipeline(): GenerationPipeline {
  if (!pipeline) {
    const llm = getLLMClient();
    const promptsDir = join(__dirname, '..', '..', 'prompts');
    const prompts = loadPrompts(promptsDir);
    pipeline = new GenerationPipeline(llm, prompts, config.llmModel, config.llmContextWindow);
  }
  return pipeline;
}

function getRetriever(): RAGRetriever {
  if (!retriever) {
    const embeddingClient = getEmbeddingClient();
    retriever = new RAGRetriever(getPool(), embeddingClient);
  }
  return retriever;
}

// --- Generate Specification ---
const GenerateSpecSchema = z.object({
  description: z.string().min(10).max(50000),
  projectId: z.string().uuid(),
});

router.post('/specs', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = GenerateSpecSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
    return;
  }

  // Reject whitespace-only descriptions
  if (!input.data.description.trim()) {
    res
      .status(400)
      .json({
        error: { code: 'VALIDATION_ERROR', message: 'Description cannot be whitespace only' },
      });
    return;
  }

  const project = await projectRepo.getProject(input.data.projectId, req.userId!);
  if (!project) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    return;
  }

  try {
    // Get RAG context
    const ragResult = await getRetriever().retrieve(input.data.description, project.id);

    // Generate
    const result = await getPipeline().generateSpec(
      { description: input.data.description, projectId: project.id },
      ragResult.chunks,
    );

    // Persist
    const artifact = await artifactRepo.createArtifact({
      projectId: project.id,
      type: 'specification',
      content: result.specification as unknown as Record<string, unknown>,
      model: result.provenance.model,
      promptVersion: result.provenance.promptVersion,
      contextWindowUsed: result.provenance.contextWindowUsed,
      ragChunksUsed: result.provenance.ragChunksUsed,
      retryCount: result.provenance.retryCount,
    });

    log.info({ artifactId: artifact.id, projectId: project.id }, 'Specification generated');
    recordSuccess({
      module: 'spec',
      provider: config.llmProvider,
      provenance: result.provenance,
      contextWindowSize: config.llmContextWindow,
      embeddingDurationMs: ragResult.embeddingDurationMs,
      retrievalDurationMs: ragResult.retrievalDurationMs,
      retrievedChunks: ragResult.chunks.length,
    });
    res.status(201).json({ artifact, provenance: result.provenance });
  } catch (err) {
    log.error(
      { err: (err as Error).message, projectId: project.id },
      'Specification generation failed',
    );
    recordFailure('spec', 'generation_error');
    res.status(500).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// --- Generate Architecture ---
const GenerateArchSchema = z.object({
  specificationId: z.string().uuid(),
});

router.post('/architecture', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = GenerateArchSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
    return;
  }

  try {
    const specArtifact = await artifactRepo.getArtifact(input.data.specificationId);
    if (!specArtifact || specArtifact.type !== 'specification') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Specification not found' } });
      return;
    }

    const ragResult = await getRetriever().retrieve(
      JSON.stringify(specArtifact.content).slice(0, 500),
      specArtifact.projectId,
    );

    const result = await getPipeline().generateArchitecture(
      {
        specification: specArtifact.content as unknown as Specification,
        specificationId: specArtifact.id,
        projectId: specArtifact.projectId,
      },
      ragResult.chunks,
    );

    const artifact = await artifactRepo.createArtifact({
      projectId: specArtifact.projectId,
      type: 'architecture',
      content: result.architecture as unknown as Record<string, unknown>,
      parentArtifactId: specArtifact.id,
      model: result.provenance.model,
      promptVersion: result.provenance.promptVersion,
      contextWindowUsed: result.provenance.contextWindowUsed,
      ragChunksUsed: result.provenance.ragChunksUsed,
      retryCount: result.provenance.retryCount,
    });

    log.info({ artifactId: artifact.id }, 'Architecture generated');
    recordSuccess({
      module: 'architecture',
      provider: config.llmProvider,
      provenance: result.provenance,
      contextWindowSize: config.llmContextWindow,
      embeddingDurationMs: ragResult.embeddingDurationMs,
      retrievalDurationMs: ragResult.retrievalDurationMs,
      retrievedChunks: ragResult.chunks.length,
    });
    res.status(201).json({ artifact, provenance: result.provenance });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Architecture generation failed');
    recordFailure('architecture', 'generation_error');
    res.status(500).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// --- Generate Tasks ---
const GenerateTasksSchema = z.object({
  architectureId: z.string().uuid(),
});

router.post('/tasks', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = GenerateTasksSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
    return;
  }

  try {
    const archArtifact = await artifactRepo.getArtifact(input.data.architectureId);
    if (!archArtifact || archArtifact.type !== 'architecture') {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Architecture document not found' } });
      return;
    }

    const result = await getPipeline().generateTasks({
      architecture: archArtifact.content as unknown as ArchitectureDocument,
      architectureId: archArtifact.id,
      projectId: archArtifact.projectId,
    });

    const artifact = await artifactRepo.createArtifact({
      projectId: archArtifact.projectId,
      type: 'task_breakdown',
      content: result.tasks as unknown as Record<string, unknown>,
      parentArtifactId: archArtifact.id,
      model: result.provenance.model,
      promptVersion: result.provenance.promptVersion,
      contextWindowUsed: result.provenance.contextWindowUsed,
      ragChunksUsed: result.provenance.ragChunksUsed,
      retryCount: result.provenance.retryCount,
    });

    log.info({ artifactId: artifact.id }, 'Tasks generated');
    recordSuccess({
      module: 'tasks',
      provider: config.llmProvider,
      provenance: result.provenance,
      contextWindowSize: config.llmContextWindow,
      retrievedChunks: 0,
    });
    res.status(201).json({ artifact, provenance: result.provenance });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Task generation failed');
    recordFailure('tasks', 'generation_error');
    res.status(500).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// --- Generate Product Vision ---
const GenerateVisionSchema = z.object({
  projectId: z.string().uuid(),
  description: z.string().min(10).max(50000),
  specificationId: z.string().uuid().optional(),
});

router.post('/vision', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = GenerateVisionSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
    return;
  }

  try {
    const project = await projectRepo.getProject(input.data.projectId, req.userId!);
    if (!project) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    // Get spec if provided
    let spec: Specification | undefined;
    if (input.data.specificationId) {
      const specArtifact = await artifactRepo.getArtifact(input.data.specificationId);
      if (specArtifact) spec = specArtifact.content as unknown as Specification;
    }

    const { VisionGenerator } = await import('../../generation/vision-generator.js');
    const llm = createLLMClient(config);
    const promptsDir = join(__dirname, '..', '..', 'prompts');
    const prompts = loadPrompts(promptsDir);
    const generator = new VisionGenerator(llm, prompts, config.llmModel, config.llmContextWindow);

    const result = await generator.generate(input.data.description, spec);

    const artifact = await artifactRepo.createArtifact({
      projectId: project.id,
      type: 'product_vision',
      content: result.vision as unknown as Record<string, unknown>,
      model: result.provenance.model,
      promptVersion: result.provenance.promptVersion,
      contextWindowUsed: result.provenance.contextWindowUsed,
      ragChunksUsed: 0,
      retryCount: result.provenance.retryCount,
    });

    recordSuccess({
      module: 'vision',
      provider: config.llmProvider,
      provenance: result.provenance,
      contextWindowSize: config.llmContextWindow,
      retrievedChunks: 0,
    });

    res.status(201).json({ artifact, provenance: result.provenance });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Vision generation failed');
    recordFailure('vision', 'generation_error');
    res.status(500).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// --- Generate Risk Assessment ---
const GenerateRisksSchema = z.object({
  specificationId: z.string().uuid(),
  architectureId: z.string().uuid(),
});

router.post('/risks', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = GenerateRisksSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
    return;
  }

  try {
    const specArtifact = await artifactRepo.getArtifact(input.data.specificationId);
    if (!specArtifact || specArtifact.type !== 'specification') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Specification not found' } });
      return;
    }

    const archArtifact = await artifactRepo.getArtifact(input.data.architectureId);
    if (!archArtifact || archArtifact.type !== 'architecture') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Architecture not found' } });
      return;
    }

    const { RiskGenerator } = await import('../../generation/risk-generator.js');
    const llm = createLLMClient(config);
    const promptsDir = join(__dirname, '..', '..', 'prompts');
    const prompts = loadPrompts(promptsDir);
    const generator = new RiskGenerator(llm, prompts, config.llmModel, config.llmContextWindow);

    const spec = specArtifact.content as unknown as Specification;
    const arch = archArtifact.content as unknown as ArchitectureDocument;
    const result = await generator.generate(spec, arch);

    const artifact = await artifactRepo.createArtifact({
      projectId: specArtifact.projectId,
      type: 'risk_assessment',
      content: result.assessment as unknown as Record<string, unknown>,
      parentArtifactId: archArtifact.id,
      model: result.provenance.model,
      promptVersion: result.provenance.promptVersion,
      contextWindowUsed: result.provenance.contextWindowUsed,
      ragChunksUsed: 0,
      retryCount: result.provenance.retryCount,
    });

    recordSuccess({
      module: 'risks',
      provider: config.llmProvider,
      provenance: result.provenance,
      contextWindowSize: config.llmContextWindow,
      retrievedChunks: 0,
    });

    res.status(201).json({ artifact, provenance: result.provenance });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Risk assessment failed');
    recordFailure('risks', 'generation_error');
    res.status(500).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// --- Generate Diagrams (deterministic — no LLM call) ---
const GenerateDiagramsSchema = z.object({
  architectureId: z.string().uuid(),
  projectName: z.string().optional(),
});

router.post('/diagrams', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = GenerateDiagramsSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
    return;
  }

  try {
    const archArtifact = await artifactRepo.getArtifact(input.data.architectureId);
    if (!archArtifact || archArtifact.type !== 'architecture') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Architecture not found' } });
      return;
    }

    const { generateDiagrams, validateMermaid } = await import('../../diagrams/mermaid.js');
    const arch = archArtifact.content as unknown as ArchitectureDocument;
    const start = Date.now();
    const diagrams = generateDiagrams(arch, input.data.projectName || 'System');
    const generationDurationMs = Date.now() - start;

    // Validate all diagrams
    const validation = Object.entries(diagrams).map(([key, source]) => ({
      diagram: key,
      ...validateMermaid(source),
    }));

    // Store as artifact
    const artifact = await artifactRepo.createArtifact({
      projectId: archArtifact.projectId,
      type: 'diagrams',
      content: diagrams as unknown as Record<string, unknown>,
      parentArtifactId: archArtifact.id,
      model: 'deterministic',
      promptVersion: 'n/a',
      contextWindowUsed: 0,
      ragChunksUsed: 0,
      retryCount: 0,
    });

    recordSuccess({
      module: 'diagrams',
      provider: 'deterministic',
      provenance: {
        model: 'deterministic',
        promptVersion: 'n/a',
        generatedAt: new Date().toISOString(),
        contextWindowUsed: 0,
        ragChunksUsed: 0,
        retryCount: 0,
        truncated: false,
        generationDurationMs,
      },
      contextWindowSize: 0,
      retrievedChunks: 0,
    });

    res.status(201).json({ artifact, diagrams, validation });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Diagram generation failed');
    recordFailure('diagrams', 'generation_error');
    res.status(500).json({ error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

export { router as generationRouter };
