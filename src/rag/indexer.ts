import type { Pool } from 'pg';
import type { LLMClient } from '../llm/interface.js';
import { parseProjectFiles } from './file-parser.js';
import { chunkText } from './chunker.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('rag-indexer');

export interface IndexResult {
  totalFiles: number;
  indexedFiles: number;
  skippedFiles: number;
  totalChunks: number;
  durationMs: number;
  errors: { file: string; error: string }[];
}

export class RAGIndexer {
  constructor(
    private readonly pool: Pool,
    private readonly embeddingClient: LLMClient,
    private readonly chunkTokenCount: number = 512,
  ) {}

  async indexProject(projectId: string, rootDir: string, maxFiles: number = 500): Promise<IndexResult> {
    const start = Date.now();
    const errors: { file: string; error: string }[] = [];

    // Parse files
    const { files, skipped } = parseProjectFiles(rootDir, [], maxFiles);
    log.info({ files: files.length, skipped: skipped.length, projectId }, 'Starting indexing');

    // Delete existing chunks for this project (clean re-index)
    await this.pool.query('DELETE FROM indexed_chunks WHERE project_id = $1', [projectId]);

    let totalChunks = 0;

    for (const file of files) {
      try {
        const chunks = chunkText(file.content, this.chunkTokenCount);

        for (const chunk of chunks) {
          try {
            const embeddingResult = await this.embeddingClient.embed(chunk.content);

            await this.pool.query(
              `INSERT INTO indexed_chunks (project_id, file_path, content, embedding, token_count, metadata)
               VALUES ($1, $2, $3, $4::vector, $5, $6)`,
              [
                projectId,
                file.filePath,
                chunk.content,
                `[${embeddingResult.embedding.join(',')}]`,
                chunk.tokenCount,
                JSON.stringify({ index: chunk.index, totalChunks: chunks.length }),
              ],
            );
            totalChunks++;
          } catch (err) {
            log.warn({ file: file.filePath, chunkIndex: chunk.index, err: (err as Error).message }, 'Chunk embedding failed, skipping');
          }
        }
      } catch (err) {
        errors.push({ file: file.filePath, error: (err as Error).message });
        log.warn({ file: file.filePath, err: (err as Error).message }, 'File indexing failed');
      }
    }

    const result: IndexResult = {
      totalFiles: files.length + skipped.length,
      indexedFiles: files.length - errors.length,
      skippedFiles: skipped.length + errors.length,
      totalChunks,
      durationMs: Date.now() - start,
      errors,
    };

    log.info(result, 'Indexing complete');
    return result;
  }
}
