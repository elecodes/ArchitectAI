import type { LLMClient } from '../llm/interface.js';
import type { LoadedPrompt } from '../prompts/loader.js';
import type { RAGChunk } from '../rag/types.js';
import {
  SpecGenerator,
  type SpecGenerationInput,
  type SpecGenerationResult,
} from './spec-generator.js';
import {
  ArchGenerator,
  type ArchGenerationInput,
  type ArchGenerationResult,
} from './arch-generator.js';
import {
  TaskGenerator,
  type TaskGenerationInput,
  type TaskGenerationResult,
} from './task-generator.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('pipeline');

export class GenerationPipeline {
  private readonly specGenerator: SpecGenerator;
  private readonly archGenerator: ArchGenerator;
  private readonly taskGenerator: TaskGenerator;

  constructor(
    llm: LLMClient,
    prompts: Map<string, LoadedPrompt>,
    model: string,
    contextWindow: number,
  ) {
    this.specGenerator = new SpecGenerator(llm, prompts, model, contextWindow);
    this.archGenerator = new ArchGenerator(llm, prompts, model, contextWindow);
    this.taskGenerator = new TaskGenerator(llm, prompts, model, contextWindow);
  }

  async generateSpec(
    input: SpecGenerationInput,
    ragChunks: RAGChunk[] = [],
  ): Promise<SpecGenerationResult> {
    log.info({ projectId: input.projectId }, 'Pipeline: generating specification');
    return this.specGenerator.generate(input, ragChunks);
  }

  async generateArchitecture(
    input: ArchGenerationInput,
    ragChunks: RAGChunk[] = [],
  ): Promise<ArchGenerationResult> {
    log.info(
      { projectId: input.projectId, specId: input.specificationId },
      'Pipeline: generating architecture',
    );
    return this.archGenerator.generate(input, ragChunks);
  }

  async generateTasks(
    input: TaskGenerationInput,
    ragChunks: RAGChunk[] = [],
  ): Promise<TaskGenerationResult> {
    log.info(
      { projectId: input.projectId, archId: input.architectureId },
      'Pipeline: generating tasks',
    );
    return this.taskGenerator.generate(input, ragChunks);
  }
}
