import type { LLMClient } from '../llm/interface.js';
import type { LoadedPrompt } from '../prompts/loader.js';
import { ContextWindowManager } from './context-window.js';
import { OutputValidator } from './output-validator.js';
import { generateWithValidation } from './retry.js';
import { ProductVisionSchema, type ProductVision, type Specification } from './schemas.js';
import { createChildLogger } from '../logger.js';
import type { GenerationProvenance } from './spec-generator.js';

const log = createChildLogger('vision-generator');

export interface VisionGenerationResult {
  vision: ProductVision;
  provenance: GenerationProvenance;
}

export class VisionGenerator {
  private readonly validator = new OutputValidator();
  private readonly contextManager: ContextWindowManager;

  constructor(
    private readonly llm: LLMClient,
    private readonly prompts: Map<string, LoadedPrompt>,
    private readonly model: string,
    contextWindow: number,
  ) {
    this.contextManager = new ContextWindowManager(contextWindow);
  }

  async generate(description: string, spec?: Specification): Promise<VisionGenerationResult> {
    const prompt = this.prompts.get('vision');
    if (!prompt) throw new Error('Vision prompt not loaded');
    const retryPrompt = this.prompts.get('retry');
    if (!retryPrompt) throw new Error('Retry prompt not loaded');

    let inputContent = description;
    if (spec) {
      inputContent += '\n\nExisting Specification:\n' + JSON.stringify(spec, null, 2);
    }

    const userPrompt = '<USER_INPUT>\n' + inputContent + '\n</USER_INPUT>';

    const fitResult = this.contextManager.fitToContext({
      systemPrompt: prompt.content,
      userInput: userPrompt,
      ragChunks: [],
    });

    const result = await generateWithValidation(
      this.llm,
      { systemPrompt: prompt.content, prompt: userPrompt, temperature: 0.3, maxTokens: 4096 },
      ProductVisionSchema,
      this.validator,
      retryPrompt,
    );

    log.info({ retryCount: result.retryCount }, 'Product vision generated');

    return {
      vision: result.data,
      provenance: {
        model: this.model,
        promptVersion: prompt.version,
        generatedAt: new Date().toISOString(),
        contextWindowUsed: fitResult.budget.systemPromptTokens + fitResult.budget.userInputTokens,
        ragChunksUsed: 0,
        retryCount: result.retryCount,
        truncated: false,
      },
    };
  }
}
