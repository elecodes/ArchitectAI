import { config } from './config/index.js';
import { createChildLogger } from './logger.js';
import { getPool, closePool } from './db/connection.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './api/index.js';
import { loadPrompts } from './prompts/loader.js';
import { createLLMClient } from './llm/factory.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = createChildLogger('boot');
const __dirname = dirname(fileURLToPath(import.meta.url));

async function boot(): Promise<void> {
  log.info({ provider: config.llmProvider, model: config.llmModel }, 'ArchitectAI starting...');

  // 1. Run database migrations
  const pool = getPool();
  const migrationsDir = join(__dirname, 'db', 'migrations');
  await runMigrations(pool, migrationsDir);

  // 2. Load prompts
  const promptsDir = join(__dirname, 'prompts');
  const prompts = loadPrompts(promptsDir);
  log.info({ prompts: prompts.size }, 'Prompts loaded');

  // 3. Create LLM client
  const llm = createLLMClient(config);
  const healthy = await llm.isHealthy();
  log.info({ provider: config.llmProvider, healthy }, 'LLM client initialized');

  // 4. Start HTTP server
  const app = createApp();
  const server = app.listen(config.port, () => {
    log.info({ port: config.port }, 'ArchitectAI ready');
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down...');
    server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
  log.fatal({ err: err.message }, 'Failed to start ArchitectAI');
  process.exit(1);
});
