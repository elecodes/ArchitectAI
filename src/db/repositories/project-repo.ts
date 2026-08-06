import { getPool } from '../connection.js';

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export async function createProject(ownerId: string, name: string, description?: string): Promise<Project> {
  const pool = getPool();
  const { rows } = await pool.query(
    'INSERT INTO projects (owner_id, name, description) VALUES ($1, $2, $3) RETURNING *',
    [ownerId, name, description || null],
  );
  return mapRow(rows[0]);
}

export async function listProjects(ownerId: string): Promise<Project[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM projects WHERE owner_id = $1 ORDER BY created_at DESC',
    [ownerId],
  );
  return rows.map(mapRow);
}

export async function getProject(id: string, ownerId: string): Promise<Project | null> {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
    [id, ownerId],
  );
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function deleteProject(id: string, ownerId: string): Promise<boolean> {
  const pool = getPool();
  const result = await pool.query(
    'DELETE FROM projects WHERE id = $1 AND owner_id = $2',
    [id, ownerId],
  );
  return (result.rowCount ?? 0) > 0;
}

function mapRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    description: row.description as string | null,
    config: row.config as Record<string, unknown>,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
  };
}
