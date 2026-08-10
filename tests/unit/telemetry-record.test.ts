import { describe, it, expect } from 'vitest';
import {
  toGenerationRecord,
  failureRecord,
  type RecordGenerationOptions,
} from '../../src/telemetry/record.js';

const opts: RecordGenerationOptions = {
  module: 'spec',
  provider: 'openrouter',
  provenance: {
    model: 'anthropic/claude-3.5-sonnet',
    promptVersion: 'spec-v1',
    generatedAt: '2026-08-10T00:00:00.000Z',
    contextWindowUsed: 12000,
    ragChunksUsed: 2,
    retryCount: 1,
    truncated: false,
    generationDurationMs: 400,
    promptTokens: 1000,
    completionTokens: 500,
  },
  contextWindowSize: 128000,
  embeddingDurationMs: 5,
  retrievalDurationMs: 10,
  retrievedChunks: 3,
  similarityScores: [0.9, 0.8, 0.7],
};

describe('telemetry records', () => {
  it('builds a success record with computed totals', () => {
    const record = toGenerationRecord(opts);

    expect(record.module).toBe('spec');
    expect(record.provider).toBe('openrouter');
    expect(record.status).toBe('success');
    expect(record.totalDurationMs).toBe(415); // 400 + 5 + 10
    expect(record.totalTokens).toBe(1500); // 1000 + 500
    expect(record.retrievedChunks).toBe(3);
    expect(record.fittedChunks).toBe(2);
    expect(record.similarityScores).toEqual([0.9, 0.8, 0.7]);
    expect(record.contextWindowSize).toBe(128000);
    expect(record.contextWindowUsed).toBe(12000);
    expect(record.retryCount).toBe(1);
  });

  it('defaults missing provenance stats to zero', () => {
    const record = toGenerationRecord({
      module: 'tasks',
      provider: 'mock',
      provenance: {
        model: 'mock-model',
        promptVersion: 'tasks-v1',
        generatedAt: new Date().toISOString(),
        contextWindowUsed: 0,
        ragChunksUsed: 0,
        retryCount: 0,
        truncated: false,
      },
      contextWindowSize: 128000,
      retrievedChunks: 0,
    });

    expect(record.totalDurationMs).toBe(0);
    expect(record.totalTokens).toBe(0);
    expect(record.status).toBe('success');
  });

  it('builds a failure record', () => {
    const record = failureRecord({
      module: 'risks',
      provider: 'openai',
      model: 'gpt-4o',
      errorCategory: 'generation_error',
    });

    expect(record.status).toBe('failure');
    expect(record.errorCategory).toBe('generation_error');
    expect(record.module).toBe('risks');
    expect(record.provider).toBe('openai');
    expect(record.model).toBe('gpt-4o');
  });
});
