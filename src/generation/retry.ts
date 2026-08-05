import type { LLMClient, CompletionRequest, CompletionResponse } from '../llm/interface.js';
import type { OutputValidator, ValidationResult } from './output-validator.js';
import type { LoadedPrompt } from '../prompts/loader.js';
import { z } from 'zod';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('retry');

export class GenerationError extends Error {
  public readonly code = 'GENERATION_FAILED';
  public readonly statusCode = 500;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'GenerationError';
    this.details = details;
  }
}

export interface GenerationResult<T> {
  data: T;
  response: CompletionResponse;
  retryCount: number;
}

export async function generateWithValidation<T>(
  llm: LLMClient,
  request: CompletionRequest,
  schema: z.ZodType<T>,
  validator: OutputValidator,
  retryPrompt: LoadedPrompt,
): Promise<GenerationResult<T>> {
  // Attempt 1
  const response = await llm.complete(request);
  const result = validator.validate(response.content, schema);

  if (result.success) {
    return { data: result.data!, response, retryCount: 0 };
  }

  // Log first failure
  log.info({
    parseError: result.error?.parseError,
    zodError: result.error?.zodError,
    rawLength: result.error?.raw.length,
  }, 'First attempt invalid, retrying with stricter prompt');

  // Attempt 2: retry with error context
  const errorContext = result.error?.parseError
    ? `JSON parse error: ${result.error.parseError}`
    : `Schema validation error: ${result.error?.zodError}`;

  const retryRequest: CompletionRequest = {
    systemPrompt: retryPrompt.content,
    prompt: `${errorContext}\n\nOriginal request:\n${request.prompt}`,
    temperature: 0.1, // Lower temperature for stricter output
    maxTokens: request.maxTokens,
  };

  const retryResponse = await llm.complete(retryRequest);
  const retryResult = validator.validate(retryResponse.content, schema);

  if (retryResult.success) {
    log.info('Retry succeeded');
    return { data: retryResult.data!, response: retryResponse, retryCount: 1 };
  }

  // Both attempts failed
  log.error({
    parseError: retryResult.error?.parseError,
    zodError: retryResult.error?.zodError,
  }, 'Retry also failed — generation error');

  throw new GenerationError('LLM produced invalid output after retry', {
    attempts: 2,
    firstError: result.error,
    retryError: retryResult.error,
  });
}
