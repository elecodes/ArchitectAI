import type { Pool } from 'pg';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('telemetry');

export interface GenerationRecord {
  module: string;
  model: string;
  promptVersion: string;
  generationDurationMs: number;
  embeddingDurationMs: number;
  retrievalDurationMs: number;
  totalDurationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  retrievedChunks: number;
  fittedChunks: number;
  truncated: boolean;
  similarityScores: number[];
  contextWindowSize: number;
  contextWindowUsed: number;
  status: 'success' | 'validation_retry' | 'failure';
  retryCount: number;
  errorCategory?: string;
}

export class GenerationTracker {
  constructor(private readonly pool: Pool) {}

  async record(data: GenerationRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO generation_telemetry (
          module, model, prompt_version,
          generation_duration_ms, embedding_duration_ms, retrieval_duration_ms, total_duration_ms,
          prompt_tokens, completion_tokens, total_tokens,
          retrieved_chunks, fitted_chunks, truncated, similarity_scores,
          context_window_size, context_window_used,
          status, retry_count, error_category
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          data.module,
          data.model,
          data.promptVersion,
          data.generationDurationMs,
          data.embeddingDurationMs,
          data.retrievalDurationMs,
          data.totalDurationMs,
          data.promptTokens,
          data.completionTokens,
          data.totalTokens,
          data.retrievedChunks,
          data.fittedChunks,
          data.truncated,
          JSON.stringify(data.similarityScores),
          data.contextWindowSize,
          data.contextWindowUsed,
          data.status,
          data.retryCount,
          data.errorCategory || null,
        ],
      );

      // Also log to stdout for container log aggregation
      log.info(data, 'Generation telemetry recorded');
    } catch (err) {
      // Telemetry should never block generation — fire and forget
      log.error({ err: (err as Error).message }, 'Failed to persist telemetry');
    }
  }
}
