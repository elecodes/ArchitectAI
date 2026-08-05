import pg from 'pg';
import { config } from '../config/index.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('database');

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

pool.on('error', (err) => {
  log.error({ err: err.message }, 'Unexpected database pool error');
});

export function getPool(): pg.Pool {
  return pool;
}

export async function closePool(): Promise<void> {
  log.info('Draining database connection pool...');
  await pool.end();
  log.info('Database pool closed');
}
