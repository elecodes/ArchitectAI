import type { LLMClient } from '../llm/interface.js';
import type { LoadedPrompt } from '../prompts/loader.js';
import { ContextWindowManager } from './context-window.js';
import { OutputValidator } from './output-validator.js';
import { generateWithValidation } from './retry.js';
import {
  RiskAssessmentSchema,
  type RiskAssessment,
  type Specification,
  type ArchitectureDocument,
} from './schemas.js';
import { createChildLogger } from '../logger.js';
import type { GenerationProvenance } from './spec-generator.js';

const log = createChildLogger('risk-generator');

export interface RiskGenerationResult {
  assessment: RiskAssessment;
  provenance: GenerationProvenance;
}

export class RiskGenerator {
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

  async generate(spec: Specification, arch: ArchitectureDocument): Promise<RiskGenerationResult> {
    const prompt = this.prompts.get('risk-assessment');
    if (!prompt) throw new Error('Risk assessment prompt not loaded');
    const retryPrompt = this.prompts.get('retry');
    if (!retryPrompt) throw new Error('Retry prompt not loaded');

    const inputContent =
      'Specification:\n' +
      JSON.stringify(spec, null, 2) +
      '\n\nArchitecture:\n' +
      JSON.stringify(arch, null, 2);
    const userPrompt = '<USER_INPUT>\n' + inputContent + '\n</USER_INPUT>';

    const fitResult = this.contextManager.fitToContext({
      systemPrompt: prompt.content,
      userInput: userPrompt,
      ragChunks: [],
    });

    // Truncate if needed
    const maxChars = fitResult.budget.availableForRAG * 4;
    const fittedInput =
      inputContent.length > maxChars
        ? '<USER_INPUT>\n' + inputContent.slice(0, maxChars) + '\n...[truncated]\n</USER_INPUT>'
        : userPrompt;

    const result = await generateWithValidation(
      this.llm,
      { systemPrompt: prompt.content, prompt: fittedInput, temperature: 0.3, maxTokens: 4096 },
      RiskAssessmentSchema,
      this.validator,
      retryPrompt,
    );

    log.info(
      { risks: result.data.risks.length, retryCount: result.retryCount },
      'Risk assessment generated',
    );

    return {
      assessment: result.data,
      provenance: {
        model: this.model,
        promptVersion: prompt.version,
        generatedAt: new Date().toISOString(),
        contextWindowUsed: fitResult.budget.systemPromptTokens + fitResult.budget.userInputTokens,
        ragChunksUsed: 0,
        retryCount: result.retryCount,
        truncated: fitResult.truncated,
        generationDurationMs: result.response.durationMs,
        promptTokens: result.response.tokenCount.prompt,
        completionTokens: result.response.tokenCount.completion,
      },
    };
  }
}
