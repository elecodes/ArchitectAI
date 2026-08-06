import { describe, it, expect } from 'vitest';
import { generateWithValidation, GenerationError } from '../../src/generation/retry.js';
import { OutputValidator } from '../../src/generation/output-validator.js';
import { SpecificationSchema } from '../../src/generation/schemas.js';
import { MockLLMClient } from '../../src/llm/providers/mock.js';
import type { LoadedPrompt } from '../../src/prompts/loader.js';

const validator = new OutputValidator();
const retryPrompt: LoadedPrompt = { name: 'retry', version: 'v1', content: 'Try again with valid JSON', tokenEstimate: 10 };

const VALID_SPEC = JSON.stringify({
  functionalRequirements: [{ id: 'FR-1', description: 'test', priority: 'must' }],
  acceptanceCriteria: ['WHEN x THEN y'],
  constraints: [],
  dependencies: [],
});

describe('generateWithValidation', () => {
  it('succeeds on first attempt with valid output', async () => {
    const llm = new MockLLMClient({ completionResponses: [VALID_SPEC] });
    const result = await generateWithValidation(llm, { prompt: 'test', systemPrompt: 'sys' }, SpecificationSchema, validator, retryPrompt);
    expect(result.retryCount).toBe(0);
    expect(result.data.functionalRequirements).toHaveLength(1);
  });

  it('retries once on invalid JSON and succeeds on second attempt', async () => {
    const llm = new MockLLMClient({ completionResponses: ['invalid json', VALID_SPEC] });
    const result = await generateWithValidation(llm, { prompt: 'test', systemPrompt: 'sys' }, SpecificationSchema, validator, retryPrompt);
    expect(result.retryCount).toBe(1);
    expect(result.data.functionalRequirements).toHaveLength(1);
    expect(llm.getCallCount('complete')).toBe(2);
  });

  it('throws GenerationError after both attempts fail', async () => {
    const llm = new MockLLMClient({ completionResponses: ['bad', 'also bad'] });
    await expect(
      generateWithValidation(llm, { prompt: 'test', systemPrompt: 'sys' }, SpecificationSchema, validator, retryPrompt)
    ).rejects.toThrow(GenerationError);
  });

  it('does NOT retry on timeout (propagates error directly)', async () => {
    const llm = new MockLLMClient({ shouldFail: true, failureError: 'Request timed out' });
    await expect(
      generateWithValidation(llm, { prompt: 'test', systemPrompt: 'sys' }, SpecificationSchema, validator, retryPrompt)
    ).rejects.toThrow('Request timed out');
    expect(llm.getCallCount('complete')).toBe(1); // Only 1 call — no retry
  });
});
