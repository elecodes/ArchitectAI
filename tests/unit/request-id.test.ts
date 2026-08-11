import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

const { loggerMock, accessLogMock } = vi.hoisted(() => ({
  loggerMock: { child: vi.fn() },
  accessLogMock: vi.fn(),
}));

vi.mock('../../src/logger.js', () => ({ logger: loggerMock }));

import { requestIdMiddleware } from '../../src/api/middleware/request-id.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('requestIdMiddleware', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (_req, res) => {
      res.status(201).json({ ok: true });
    });
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  beforeEach(() => {
    accessLogMock.mockReset();
    loggerMock.child.mockReset();
    loggerMock.child.mockReturnValue({ info: accessLogMock });
  });

  it('uses and sanitizes the incoming X-Request-ID header when present', async () => {
    const res = await fetch(`${baseUrl}/test`, {
      headers: { 'x-request-id': 'corr-abc-123!@# .$%' },
    });

    expect(res.status).toBe(201);
    expect(res.headers.get('x-request-id')).toBe('corr-abc-123');
    expect(loggerMock.child).toHaveBeenCalledWith({ requestId: 'corr-abc-123' });
  });

  it('generates a UUID request id when the header is absent', async () => {
    const res = await fetch(`${baseUrl}/test`);
    const id = res.headers.get('x-request-id');

    expect(id).toMatch(UUID_RE);
    expect(loggerMock.child).toHaveBeenCalledWith({ requestId: id });
  });

  it('emits an access log line with method, path, status and duration on finish', async () => {
    await fetch(`${baseUrl}/test`);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(accessLogMock).toHaveBeenCalledTimes(1);
    expect(accessLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/test',
        status: 201,
        durationMs: expect.any(Number),
      }),
      'request complete',
    );
  });

  it('sets the X-Request-ID response header on every request', async () => {
    const res = await fetch(`${baseUrl}/test`);
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });
});
