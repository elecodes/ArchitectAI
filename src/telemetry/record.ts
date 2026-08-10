import type { GenerationRecord } from './generation-tracker.js';
import type { GenerationProvenance } from '../generation/spec-generator.js';

export interface RecordGenerationOptions {
  module: string;
  provider: string;
  provenance: GenerationProvenance;
  contextWindowSize: number;
  embeddingDurationMs?: number;
  retrievalDurationMs?: number;
  retrievedChunks: number;
  similarityScores?: number[];
}

export function toGenerationRecord(opts: RecordGenerationOptions): GenerationRecord {
  const generationDurationMs = opts.provenance.generationDurationMs ?? 0;
  const promptTokens = opts.provenance.promptTokens ?? 0;
  const completionTokens = opts.provenance.completionTokens ?? 0;
  const embeddingDurationMs = opts.embeddingDurationMs ?? 0;
  const retrievalDurationMs = opts.retrievalDurationMs ?? 0;

  return {
    module: opts.module,
    provider: opts.provider,
    model: opts.provenance.model,
    promptVersion: opts.provenance.promptVersion,
    generationDurationMs,
    embeddingDurationMs,
    retrievalDurationMs,
    totalDurationMs: generationDurationMs + embeddingDurationMs + retrievalDurationMs,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    retrievedChunks: opts.retrievedChunks,
    fittedChunks: opts.provenance.ragChunksUsed,
    truncated: opts.provenance.truncated,
    similarityScores: opts.similarityScores ?? [],
    contextWindowSize: opts.contextWindowSize,
    contextWindowUsed: opts.provenance.contextWindowUsed,
    status: 'success',
    retryCount: opts.provenance.retryCount,
  };
}

export function failureRecord(opts: {
  module: string;
  provider: string;
  model: string;
  errorCategory: string;
}): GenerationRecord {
  return {
    module: opts.module,
    provider: opts.provider,
    model: opts.model,
    promptVersion: 'unknown',
    generationDurationMs: 0,
    embeddingDurationMs: 0,
    retrievalDurationMs: 0,
    totalDurationMs: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    retrievedChunks: 0,
    fittedChunks: 0,
    truncated: false,
    similarityScores: [],
    contextWindowSize: 0,
    contextWindowUsed: 0,
    status: 'failure',
    retryCount: 0,
    errorCategory: opts.errorCategory,
  };
}
