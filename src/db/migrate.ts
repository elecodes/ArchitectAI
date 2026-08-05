import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('migrations');

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<void> {
  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get already-applied migrations
  const { rows: applied } = await pool.query('SELECT name FROM _migrations ORDER BY id');
  const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

  // Get migration files
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      log.debug({ file }, 'Migration already applied, skipping');
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      log.info({ file }, 'Migration applied successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      log.error({ file, err: (err as Error).message }, 'Migration failed');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  const newlyApplied = files.filter((f) => !appliedSet.has(f)).length;
  log.info({ total: files.length, applied: newlyApplied }, 'Migrations complete');
}
