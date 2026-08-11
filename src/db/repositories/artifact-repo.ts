import { getPool } from '../connection.js';

export interface Artifact {
  id: string;
  projectId: string;
  type: string;
  content: Record<string, unknown>;
  parentArtifactId: string | null;
  model: string;
  promptVersion: string;
  generatedAt: Date;
  contextWindowUsed: number | null;
  ragChunksUsed: number;
  retryCount: number;
  createdAt: Date;
}

export async function createArtifact(data: {
  projectId: string;
  type: string;
  content: Record<string, unknown>;
  parentArtifactId?: string;
  model: string;
  promptVersion: string;
  contextWindowUsed?: number;
  ragChunksUsed?: number;
  retryCount?: number;
}): Promise<Artifact> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO artifacts (project_id, type, content, parent_artifact_id, model, prompt_version, context_window_used, rag_chunks_used, retry_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [
      data.projectId, data.type, JSON.stringify(data.content), data.parentArtifactId || null,
      data.model, data.promptVersion, data.contextWindowUsed || null,
      data.ragChunksUsed || 0, data.retryCount || 0,
    ],
  );
  return mapRow(rows[0]);
}

export async function getArtifact(id: string, userId: string): Promise<Artifact | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.* FROM artifacts a
     JOIN projects p ON p.id = a.project_id
     WHERE a.id = $1 AND p.owner_id = $2`,
    [id, userId],
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function listArtifacts(projectId: string, userId: string, type?: string): Promise<Artifact[]> {
  const pool = getPool();
  let query =
    `SELECT a.* FROM artifacts a
     JOIN projects p ON p.id = a.project_id
     WHERE a.project_id = $1 AND p.owner_id = $2`;
  const params: unknown[] = [projectId, userId];
  if (type) {
    query += ' AND a.type = $3';
    params.push(type);
  }
  query += ' ORDER BY a.created_at DESC';
  const { rows } = await pool.query(query, params);
  return rows.map(mapRow);
}

function mapRow(row: Record<string, unknown>): Artifact {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    type: row.type as string,
    content: row.content as Record<string, unknown>,
    parentArtifactId: row.parent_artifact_id as string | null,
    model: row.model as string,
    promptVersion: row.prompt_version as string,
    generatedAt: row.generated_at as Date,
    contextWindowUsed: row.context_window_used as number | null,
    ragChunksUsed: row.rag_chunks_used as number,
    retryCount: row.retry_count as number,
    createdAt: row.created_at as Date,
  };
}
