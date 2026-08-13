import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRunner } from '../../src/agents/runner.js';
import { AgentRunError } from '../../src/agents/contract.js';
import { GenerationError } from '../../src/generation/retry.js';
import type { AgentDefinition, AgentContext } from '../../src/agents/contract.js';
import type { LoadedPrompt } from '../../src/prompts/loader.js';
import type { RAGChunk } from '../../src/rag/types.js';
import type { CompletionRequest, CompletionResponse } from '../../src/llm/interface.js';
import { z } from 'zod';

const OutputSchema = z.object({
  result: z.string(),
  confidence: z.number(),
});

type TestInput = { query: string };
type TestOutput = { result: string; confidence: number };

const VALID_RESPONSE = JSON.stringify({ result: 'ok', confidence: 0.9 });

const prompts = new Map<string, LoadedPrompt>([
  ['test-prompt', { name: 'test-prompt', version: 'v1', content: 'You are a test agent', tokenEstimate: 12 }],
  ['retry', { name: 'retry', version: 'v1', content: 'Try again with valid JSON', tokenEstimate: 10 }],
]);

function makeAgentDef(overrides: Partial<AgentDefinition<TestInput, TestOutput>> = {}): AgentDefinition<TestInput, TestOutput> {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    promptName: 'test-prompt',
    artifactType: 'specification',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: OutputSchema,
    capabilities: ['rag:read'] as const,
    timeoutMs: 5000,
    maxTransientRetries: 3,
    ...overrides,
  };
}

type CompleteBehavior =
  | { type: 'ok'; content: string; durationMs?: number }
  | { type: 'error'; message: string }
  | { type: 'hang' };

function createMockLLM(behaviors: CompleteBehavior[]) {
  let callIndex = 0;
  const requests: CompletionRequest[] = [];

  const complete = vi.fn(async (request: CompletionRequest): Promise<CompletionResponse> => {
    requests.push(request);
    const behavior = behaviors[Math.min(callIndex, behaviors.length - 1)];
    callIndex++;

    if (behavior.type === 'ok') {
      return {
        content: behavior.content,
        durationMs: behavior.durationMs ?? 10,
        tokenCount: { prompt: 10, completion: 10 },
      };
    }
    if (behavior.type === 'error') {
      throw new Error(behavior.message);
    }
    return new Promise<CompletionResponse>(() => {});
  });

  return {
    complete,
    embed: vi.fn(async () => ({ embedding: new Array(1536).fill(0), durationMs: 5 })),
    isHealthy: vi.fn(async () => true),
    requests,
  };
}

function createMockRetriever(chunks: RAGChunk[] = []) {
  return {
    retrieve: vi.fn(async () => ({
      chunks,
      retrievalDurationMs: 50,
      embeddingDurationMs: 10,
    })),
  };
}

function createMockPersist() {
  return vi.fn(async () => ({ id: 'artifact-123' }));
}

const defaultCtx: AgentContext<TestInput> = {
  input: { query: 'test query' },
  projectId: 'proj-1',
  userId: 'user-1',
};

describe('AgentRunner', () => {
  describe('happy path', () => {
    it('returns output with correct metadata and persists artifact', async () => {
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever([
        { content: 'chunk content', filePath: 'src/a.ts', similarity: 0.9 },
      ]);
      const persist = createMockPersist();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
        persist,
      );

      const result = await runner.run(makeAgentDef(), defaultCtx);

      expect(result.output).toEqual({ result: 'ok', confidence: 0.9 });
      expect(result.retryCount).toBe(0);
      expect(result.transientRetries).toBe(0);
      expect(result.artifactId).toBe('artifact-123');
      expect(persist).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-1',
          type: 'specification',
          model: 'test-model',
        }),
      );
      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'agent:test-agent', status: 'success' }),
      );
    });
  });

  describe('input validation', () => {
    it('throws AgentRunError with AGENT_INPUT_INVALID on bad input', async () => {
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const def = makeAgentDef({
        inputSchema: z.object({ query: z.string(), required: z.string() }),
      });

      await expect(
        runner.run(def, { input: { query: 'hi' } as never, projectId: 'p', userId: 'u' }),
      ).rejects.toThrow(AgentRunError);

      try {
        await runner.run(def, { input: { query: 'hi' } as never, projectId: 'p', userId: 'u' });
      } catch (e) {
        expect((e as AgentRunError).code).toBe('AGENT_INPUT_INVALID');
      }

      expect(llm.complete).not.toHaveBeenCalled();
    });
  });

  describe('output retry', () => {
    it('retries once on invalid JSON and succeeds on second attempt', async () => {
      const llm = createMockLLM([
        { type: 'ok', content: 'not valid json {{{' },
        { type: 'ok', content: VALID_RESPONSE },
      ]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const result = await runner.run(makeAgentDef(), defaultCtx);

      expect(result.retryCount).toBe(1);
      expect(result.output).toEqual({ result: 'ok', confidence: 0.9 });
    });

    it('throws GenerationError after both attempts fail', async () => {
      const llm = createMockLLM([
        { type: 'ok', content: 'bad1' },
        { type: 'ok', content: 'bad2' },
      ]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      await expect(runner.run(makeAgentDef(), defaultCtx)).rejects.toThrow(GenerationError);

      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failure' }),
      );
    });
  });

  describe('transient retry', () => {
    it('retries on plain errors and succeeds', async () => {
      const llm = createMockLLM([
        { type: 'error', message: 'network timeout' },
        { type: 'error', message: 'network timeout' },
        { type: 'ok', content: VALID_RESPONSE },
      ]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const result = await runner.run(makeAgentDef(), defaultCtx);

      expect(result.output).toEqual({ result: 'ok', confidence: 0.9 });
      expect(result.transientRetries).toBe(2);
    });

    it('throws AGENT_TRANSIENT_FAILED after exhausting retries', async () => {
      const llm = createMockLLM([
        { type: 'error', message: 'fail 1' },
        { type: 'error', message: 'fail 2' },
        { type: 'error', message: 'fail 3' },
        { type: 'error', message: 'fail 4' },
      ]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      await expect(runner.run(makeAgentDef(), defaultCtx)).rejects.toThrow(AgentRunError);

      try {
        await runner.run(makeAgentDef(), defaultCtx);
      } catch (e) {
        expect((e as AgentRunError).code).toBe('AGENT_TRANSIENT_FAILED');
      }

      expect(recordSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failure' }),
      );
    });
  });

  describe('timeout', () => {
    it('throws AGENT_TIMEOUT when LLM hangs', async () => {
      const llm = createMockLLM([{ type: 'hang' }]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const def = makeAgentDef({ timeoutMs: 40 });

      await expect(runner.run(def, defaultCtx)).rejects.toThrow(AgentRunError);

      try {
        await runner.run(def, defaultCtx);
      } catch (e) {
        expect((e as AgentRunError).code).toBe('AGENT_TIMEOUT');
      }
    });
  });

  describe('RAG', () => {
    it('includes CONTEXT in prompt when rag:read capability present', async () => {
      const chunks: RAGChunk[] = [
        { content: 'existing code', filePath: 'src/auth.ts', similarity: 0.9 },
      ];
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever(chunks);
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const result = await runner.run(makeAgentDef(), defaultCtx);

      const prompt = llm.requests[0].prompt;
      expect(prompt).toContain('<CONTEXT>');
      expect(prompt).toContain('reference material only');
      expect(prompt).toContain('existing code');
      expect(prompt).toContain('<USER_INPUT>');
      expect(result.provenance.ragChunksUsed).toBe(1);
    });

    it('does not call retriever when rag:read capability absent', async () => {
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever([
        { content: 'should not appear', filePath: 'x.ts', similarity: 0.9 },
      ]);
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const def = makeAgentDef({ capabilities: [] as const });
      await runner.run(def, defaultCtx);

      expect(retriever.retrieve).not.toHaveBeenCalled();
      expect(llm.requests[0].prompt).not.toContain('<CONTEXT>');
    });

    it('uses ctx.ragChunks directly and skips retriever', async () => {
      const injectedChunks: RAGChunk[] = [
        { content: 'injected chunk', filePath: 'injected.ts', similarity: 0.95 },
      ];
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const ctx: AgentContext<TestInput> = {
        ...defaultCtx,
        ragChunks: injectedChunks,
      };

      const result = await runner.run(makeAgentDef(), ctx);

      expect(retriever.retrieve).not.toHaveBeenCalled();
      expect(llm.requests[0].prompt).toContain('injected chunk');
      expect(result.provenance.ragChunksUsed).toBe(1);
    });
  });

  describe('truncation', () => {
    it('truncates when chunks exceed context budget', async () => {
      const bigChunks: RAGChunk[] = [
        { content: 'A'.repeat(4000), filePath: 'a.ts', similarity: 0.9 },
        { content: 'B'.repeat(4000), filePath: 'b.ts', similarity: 0.8 },
        { content: 'C'.repeat(4000), filePath: 'c.ts', similarity: 0.7 },
      ];
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever(bigChunks);
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        4096,
        'test-provider',
        recordSpy,
      );

      const result = await runner.run(makeAgentDef(), defaultCtx);

      expect(result.truncated).toBe(true);
      expect(result.provenance.ragChunksUsed).toBeLessThan(3);
    });
  });

  describe('provenance', () => {
    it('includes model and promptVersion from prompt', async () => {
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever();
      const recordSpy = vi.fn();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
        recordSpy,
      );

      const result = await runner.run(makeAgentDef(), defaultCtx);

      expect(result.provenance.model).toBe('test-model');
      expect(result.provenance.promptVersion).toBe('v1');
    });
  });

  describe('prompt loading', () => {
    it('throws when promptName not found', async () => {
      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        prompts,
        'test-model',
        128000,
        'test-provider',
      );

      const def = makeAgentDef({ promptName: 'nonexistent' });

      await expect(runner.run(def, defaultCtx)).rejects.toThrow(
        'nonexistent prompt not loaded',
      );
    });

    it('throws when retry prompt not found', async () => {
      const noRetryPrompts = new Map<string, LoadedPrompt>([
        ['test-prompt', prompts.get('test-prompt')!],
      ]);

      const llm = createMockLLM([{ type: 'ok', content: VALID_RESPONSE }]);
      const retriever = createMockRetriever();

      const runner = new AgentRunner(
        llm as never,
        retriever as never,
        noRetryPrompts,
        'test-model',
        128000,
        'test-provider',
      );

      await expect(runner.run(makeAgentDef(), defaultCtx)).rejects.toThrow(
        'retry prompt not loaded',
      );
    });
  });
});
