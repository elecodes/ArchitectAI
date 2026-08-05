import type { Pool } from 'pg';
import type { LLMClient } from '../llm/interface.js';
import type { RAGChunk } from '../generation/context-window.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('rag-retriever');

export interface RetrievalResult {
  chunks: RAGChunk[];
  retrievalDurationMs: number;
  embeddingDurationMs: number;
}

export class RAGRetriever {
  constructor(
    private readonly pool: Pool,
    private readonly embeddingClient: LLMClient,
  ) {}

  async retrieve(
    query: string,
    projectId: string,
    topK: number = 5,
    minSimilarity: number = 0.5,
  ): Promise<RetrievalResult> {
    // Embed the query
    const embedStart = Date.now();
    const embeddingResult = await this.embeddingClient.embed(query);
    const embeddingDurationMs = Date.now() - embedStart;

    // Query pgvector
    const retrieveStart = Date.now();
    const { rows } = await this.pool.query(
      `SELECT content, file_path, 1 - (embedding <=> $1::vector) as similarity
       FROM indexed_chunks
       WHERE project_id = $2
         AND 1 - (embedding <=> $1::vector) >= $3
       ORDER BY embedding <=> $1::vector
       LIMIT $4`,
      [
        `[${embeddingResult.embedding.join(',')}]`,
        projectId,
        minSimilarity,
        topK,
      ],
    );
    const retrievalDurationMs = Date.now() - retrieveStart;

    const chunks: RAGChunk[] = rows.map(row => ({
      content: row.content,
      filePath: row.file_path,
      similarity: Number.parseFloat(row.similarity),
    }));

    log.info({
      query: query.slice(0, 100),
      projectId,
      results: chunks.length,
      topSimilarity: chunks[0]?.similarity,
      embeddingDurationMs,
      retrievalDurationMs,
    }, 'RAG retrieval complete');

    return { chunks, retrievalDurationMs, embeddingDurationMs };
  }
}
