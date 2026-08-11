import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RequestHandler } from 'express';

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  generationIsHealthy: vi.fn(),
  embeddingIsHealthy: vi.fn(),
  listObjects: vi.fn(),
}));

vi.mock('../../src/db/connection.js', () => ({
  getPool: () => ({ query: mocks.poolQuery }),
}));

vi.mock('../../src/api/routes/generation.js', () => ({
  getLLMClient: () => ({ isHealthy: mocks.generationIsHealthy }),
  getEmbeddingClient: () => ({ isHealthy: mocks.embeddingIsHealthy }),
}));

vi.mock('../../src/storage/factory.js', () => ({
  createDocumentStore: () => ({ listObjects: mocks.listObjects }),
}));

import { healthRouter } from '../../src/api/routes/health.js';

type HealthHandler = (req: unknown, res: { status: (n: number) => unknown; json: (b: unknown) => unknown }) => Promise<void>;

function getHealthHandler(): HealthHandler {
  const layer = healthRouter.stack.find(
    (l) => (l as { route?: { path: string } }).route?.path === '/health',
  ) as { route: { stack: { handle: HealthHandler }[] } };
  return layer.route.stack[0].handle;
}

function makeRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.generationIsHealthy.mockReset();
  mocks.embeddingIsHealthy.mockReset();
  mocks.listObjects.mockReset();
});

describe('GET /health', () => {
  it('reports ok and includes all components when every probe is healthy', async () => {
    mocks.poolQuery.mockResolvedValue({});
    mocks.generationIsHealthy.mockResolvedValue(true);
    mocks.embeddingIsHealthy.mockResolvedValue(true);
    mocks.listObjects.mockResolvedValue([]);

    const res = makeRes();
    await getHealthHandler()(null, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('ok');
    expect(body.components.database).toEqual({ status: 'healthy' });
    expect(body.components.llm).toEqual({
      status: 'healthy',
      generation: { status: 'healthy' },
      embedding: { status: 'healthy' },
    });
    expect(body.components.storage).toEqual({ status: 'healthy' });
    expect(body.components.telemetry.status).toBe('configured');
    expect(Object.keys(body.components)).toEqual(
      expect.arrayContaining(['database', 'llm', 'storage', 'telemetry']),
    );
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('reports degraded when an optional (llm) component is unhealthy', async () => {
    mocks.poolQuery.mockResolvedValue({});
    mocks.generationIsHealthy.mockResolvedValue(false);
    mocks.embeddingIsHealthy.mockResolvedValue(true);
    mocks.listObjects.mockResolvedValue([]);

    const res = makeRes();
    await getHealthHandler()(null, res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('degraded');
    expect(body.components.database).toEqual({ status: 'healthy' });
    expect(body.components.llm.status).toBe('unhealthy');
    expect(body.components.llm.generation.status).toBe('unhealthy');
    expect(body.components.llm.embedding.status).toBe('healthy');
  });

  it('reports degraded when storage fails', async () => {
    mocks.poolQuery.mockResolvedValue({});
    mocks.generationIsHealthy.mockResolvedValue(true);
    mocks.embeddingIsHealthy.mockResolvedValue(true);
    mocks.listObjects.mockRejectedValue(new Error('s3 denied'));

    const res = makeRes();
    await getHealthHandler()(null, res);

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('degraded');
    expect(body.components.storage.status).toBe('unhealthy');
    expect(body.components.storage.message).toContain('s3 denied');
  });

  it('reports error when the database fails', async () => {
    mocks.poolQuery.mockRejectedValue(new Error('connection refused'));
    mocks.generationIsHealthy.mockResolvedValue(true);
    mocks.embeddingIsHealthy.mockResolvedValue(true);
    mocks.listObjects.mockResolvedValue([]);

    const res = makeRes();
    await getHealthHandler()(null, res);

    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('error');
    expect(body.components.database.status).toBe('unhealthy');
    expect(body.components.database.message).toContain('connection refused');
  });

  it('never throws even when every probe rejects', async () => {
    mocks.poolQuery.mockRejectedValue(new Error('db down'));
    mocks.generationIsHealthy.mockRejectedValue(new Error('credentials failed'));
    mocks.embeddingIsHealthy.mockRejectedValue(new Error('embedding down'));
    mocks.listObjects.mockRejectedValue(new Error('s3 denied'));

    const res = makeRes();
    await expect(getHealthHandler()(null, res)).resolves.toBeUndefined();

    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('error');
    expect(body.components.llm.status).toBe('unhealthy');
    expect(body.components.storage.status).toBe('unhealthy');
  });
});
