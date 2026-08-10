import { describe, it, expect, vi } from 'vitest';
import { GenerationTracker } from '../../src/telemetry/generation-tracker.js';
import type { GenerationRecord } from '../../src/telemetry/generation-tracker.js';

const record: GenerationRecord = {
  module: 'spec',
  provider: 'bedrock',
  model: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  promptVersion: 'spec-v1',
  generationDurationMs: 100,
  embeddingDurationMs: 5,
  retrievalDurationMs: 10,
  totalDurationMs: 115,
  promptTokens: 1000,
  completionTokens: 500,
  totalTokens: 1500,
  retrievedChunks: 3,
  fittedChunks: 2,
  truncated: false,
  similarityScores: [0.8, 0.7, 0.6],
  contextWindowSize: 128000,
  contextWindowUsed: 12000,
  status: 'success',
  retryCount: 0,
};

describe('GenerationTracker', () => {
  it('inserts a record including the provider column', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const tracker = new GenerationTracker({ query } as never);
    await tracker.record(record);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('provider');
    expect(sql).toContain('module');
    expect(params[1]).toBe('bedrock');
    expect(params[2]).toBe('anthropic.claude-3-5-sonnet-20240620-v1:0');
    expect(params[17]).toBe('success');
    expect(params[18]).toBe(0);
  });

  it('defaults provider to local when not provided', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const tracker = new GenerationTracker({ query } as never);
    await tracker.record({ ...record, provider: undefined });

    const [, params] = query.mock.calls[0];
    expect(params[1]).toBe('local');
  });

  it('never throws when the insert fails', async () => {
    const query = vi.fn().mockRejectedValue(new Error('connection refused'));
    const tracker = new GenerationTracker({ query } as never);
    await expect(tracker.record(record)).resolves.toBeUndefined();
  });
});
