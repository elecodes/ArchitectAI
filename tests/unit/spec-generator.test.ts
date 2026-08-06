import { describe, it, expect } from 'vitest';
import { SpecGenerator } from '../../src/generation/spec-generator.js';
import { MockLLMClient } from '../../src/llm/providers/mock.js';
import type { LoadedPrompt } from '../../src/prompts/loader.js';

const VALID_SPEC_RESPONSE = JSON.stringify({
  functionalRequirements: [{ id: 'FR-1', description: 'Authenticate users', priority: 'must' }],
  acceptanceCriteria: ['WHEN valid credentials THEN issue token'],
  constraints: ['Use bcrypt'],
  dependencies: ['PostgreSQL'],
});

const prompts = new Map<string, LoadedPrompt>([
  ['spec', { name: 'spec', version: 'v1', content: 'Generate a spec', tokenEstimate: 50 }],
  ['retry', { name: 'retry', version: 'v1', content: 'Try again', tokenEstimate: 10 }],
]);

describe('SpecGenerator', () => {
  it('generates valid specification with provenance', async () => {
    const llm = new MockLLMClient({ completionResponses: [VALID_SPEC_RESPONSE] });
    const generator = new SpecGenerator(llm, prompts, 'mock-model', 128000);

    const result = await generator.generate({ description: 'An auth system', projectId: 'proj-1' });

    expect(result.specification.functionalRequirements).toHaveLength(1);
    expect(result.provenance.model).toBe('mock-model');
    expect(result.provenance.promptVersion).toBe('v1');
    expect(result.provenance.retryCount).toBe(0);
  });

  it('retries and succeeds on second attempt', async () => {
    const llm = new MockLLMClient({ completionResponses: ['bad json', VALID_SPEC_RESPONSE] });
    const generator = new SpecGenerator(llm, prompts, 'mock-model', 128000);

    const result = await generator.generate({ description: 'An auth system', projectId: 'proj-1' });

    expect(result.specification.functionalRequirements).toHaveLength(1);
    expect(result.provenance.retryCount).toBe(1);
  });

  it('includes CONTEXT delimiters when RAG chunks provided', async () => {
    const llm = new MockLLMClient({ completionResponses: [VALID_SPEC_RESPONSE] });
    const generator = new SpecGenerator(llm, prompts, 'mock-model', 128000);

    await generator.generate(
      { description: 'test', projectId: 'proj-1' },
      [{ content: 'existing code', filePath: 'src/auth.ts', similarity: 0.9 }],
    );

    const call = llm.getCalls()[0];
    const prompt = (call.input as { prompt: string }).prompt;
    expect(prompt).toContain('<CONTEXT>');
    expect(prompt).toContain('</CONTEXT>');
    expect(prompt).toContain('existing code');
  });

  it('has no CONTEXT section when zero RAG chunks', async () => {
    const llm = new MockLLMClient({ completionResponses: [VALID_SPEC_RESPONSE] });
    const generator = new SpecGenerator(llm, prompts, 'mock-model', 128000);

    await generator.generate({ description: 'test', projectId: 'proj-1' }, []);

    const call = llm.getCalls()[0];
    const prompt = (call.input as { prompt: string }).prompt;
    expect(prompt).not.toContain('<CONTEXT>');
  });
});
