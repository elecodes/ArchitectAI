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
  const shutdown = (signal: string) => {
    log.info(
      { signal, gracePeriodMs: config.gracePeriodMs },
      'Shutdown initiated: stopping new connections',
    );
    const forceExitTimer = setTimeout(() => {
      log.warn(
        { signal, gracePeriodMs: config.gracePeriodMs },
        'Grace period elapsed: force exiting',
      );
      server.closeAllConnections();
      process.exit(1);
    }, config.gracePeriodMs);
    forceExitTimer.unref();

    server.close(() => {
      clearTimeout(forceExitTimer);
      log.info({ signal }, 'In-flight requests drained');
      closePool()
        .then(() => {
          log.info('Shutdown complete');
          process.exit(0);
        })
        .catch((err) => {
          log.error({ err: (err as Error).message }, 'Failed to close database pool');
          process.exit(1);
        });
    });
    server.closeIdleConnections();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((err) => {
  log.fatal({ err: err.message }, 'Failed to start ArchitectAI');
  process.exit(1);
});
