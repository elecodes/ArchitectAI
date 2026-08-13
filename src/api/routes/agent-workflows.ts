import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import * as workflowRepo from '../../db/repositories/agent-workflow-repo.js';
import { Orchestrator } from '../../agents/orchestrator.js';
import { AgentRunner } from '../../agents/runner.js';
import { listAgentDefinitions } from '../../agents/registry.js';
import { createLLMClient, createEmbeddingClient } from '../../llm/factory.js';
import { RAGRetriever } from '../../rag/retriever.js';
import { loadPrompts } from '../../prompts/loader.js';
import { config } from '../../config/index.js';
import { getPool } from '../../db/connection.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('agent-workflows-api');
const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

let runner: AgentRunner | null = null;

function getRunner(): AgentRunner {
  if (!runner) {
    const llm = createLLMClient(config);
    const embeddingClient = createEmbeddingClient(config);
    const retriever = new RAGRetriever(getPool(), embeddingClient);
    const promptsDir = join(__dirname, '..', '..', 'prompts');
    const prompts = loadPrompts(promptsDir);
    runner = new AgentRunner(
      llm, retriever, prompts, config.llmModel, config.llmContextWindow,
      config.llmProvider,
    );
  }
  return runner;
}

const CreateWorkflowSchema = z.object({
  projectId: z.string().uuid(),
  idea: z.string().min(10).max(50000),
  context: z.string().max(50000).optional(),
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = CreateWorkflowSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: input.error.issues.map(i => i.message).join('; ') } });
    return;
  }

  try {
    const workflow = await workflowRepo.createWorkflow({
      projectId: input.data.projectId,
      model: config.llmModel,
      provider: config.llmProvider,
    });

    log.info({ workflowId: workflow.id, projectId: input.data.projectId }, 'Workflow created');

    const orchestrator = new Orchestrator(getRunner());
    orchestrator.execute({
      workflowId: workflow.id,
      projectId: input.data.projectId,
      userId: req.userId!,
      idea: input.data.idea,
      context: input.data.context,
    }).catch(err => {
      log.error({ err: (err as Error).message, workflowId: workflow.id }, 'Workflow execution failed');
    });

    res.status(201).json({ workflow });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to create workflow');
    res.status(500).json({ error: { code: 'WORKFLOW_CREATE_FAILED', message: 'Failed to create workflow' } });
  }
});

const ListWorkflowsSchema = z.object({
  projectId: z.string().uuid(),
});

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = ListWorkflowsSchema.safeParse(req.query);
  if (!input.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing or invalid projectId' } });
    return;
  }

  const workflows = await workflowRepo.listWorkflows(input.data.projectId, req.userId!);
  res.json({ workflows });
});

router.get('/:id/status', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const workflowId = req.params.id as string;
  const workflow = await workflowRepo.getWorkflow(workflowId, req.userId!);
  if (!workflow) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Workflow not found' } });
    return;
  }

  const steps = await workflowRepo.listSteps(workflow.id, req.userId!);
  res.json({ workflow, steps });
});

export { router as agentWorkflowsRouter };
