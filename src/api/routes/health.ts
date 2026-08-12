import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from '../../db/connection.js';
import { config } from '../../config/index.js';
import { createDocumentStore } from '../../storage/factory.js';
import type { DocumentStore } from '../../storage/document-store.js';
import { getLLMClient, getEmbeddingClient } from './generation.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

const PROBE_TIMEOUT_MS = 2000;

interface ComponentStatus {
  status: string;
  message?: string;
  [key: string]: unknown;
}

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
) as { version: string };
const version = pkg.version || 'unknown';

let documentStore: DocumentStore | null = null;

function getStore(): DocumentStore {
  if (!documentStore) {
    documentStore = createDocumentStore(config);
  }
  return documentStore;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('probe timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function statusFromResult(result: PromiseSettledResult<boolean>, name: string): ComponentStatus {
  if (result.status === 'fulfilled') {
    return result.value
      ? { status: 'healthy' }
      : { status: 'unhealthy', message: `${name} client reported unhealthy` };
  }
  return { status: 'unhealthy', message: `${name} probe failed: ${(result.reason as Error).message}` };
}

async function probeDatabase(): Promise<ComponentStatus> {
  try {
    await withTimeout(getPool().query('SELECT 1'), PROBE_TIMEOUT_MS);
    return { status: 'healthy' };
  } catch (err) {
    return { status: 'unhealthy', message: (err as Error).message };
  }
}

async function probeLLM(): Promise<ComponentStatus> {
  try {
    const [genResult, embResult] = await Promise.allSettled([
      withTimeout(getLLMClient().isHealthy(), PROBE_TIMEOUT_MS),
      withTimeout(getEmbeddingClient().isHealthy(), PROBE_TIMEOUT_MS),
    ]);
    const generation = statusFromResult(genResult, 'generation');
    const embedding = statusFromResult(embResult, 'embedding');
    const failures = [generation, embedding].filter((c) => c.status !== 'healthy');
    const messages = failures.map((c) => c.message).filter((m): m is string => Boolean(m));
    return {
      status: failures.length ? 'unhealthy' : 'healthy',
      ...(messages.length && { message: messages.join('; ') }),
      generation,
      embedding,
    };
  } catch (err) {
    return { status: 'unhealthy', message: (err as Error).message };
  }
}

async function probeStorage(): Promise<ComponentStatus> {
  try {
    await withTimeout(getStore().listObjects('health/'), PROBE_TIMEOUT_MS);
    return { status: 'healthy' };
  } catch (err) {
    return { status: 'unhealthy', message: (err as Error).message };
  }
}

router.get('/health', async (_req, res) => {
  const [database, llm, storage] = await Promise.all([probeDatabase(), probeLLM(), probeStorage()]);

  const components: Record<string, ComponentStatus> = { database, llm, storage };
  components.telemetry = {
    status: 'configured',
    message: config.cloudwatchEnabled ? 'CloudWatch sink enabled' : 'Telemetry sink disabled',
  };

  const status =
    database.status !== 'healthy'
      ? 'error'
      : llm.status !== 'healthy' || storage.status !== 'healthy'
        ? 'degraded'
        : 'ok';

  res.status(status === 'ok' ? 200 : 503).json({
    status,
    components,
    version,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter };
