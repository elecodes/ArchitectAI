import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { logger } from '../../logger.js';

export type RequestWithLog = Request & { requestId?: string; log?: Logger };

const MAX_ID_LENGTH = 64;

function sanitizeRequestId(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9-]/g, '').slice(0, MAX_ID_LENGTH);
  return sanitized || randomUUID();
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const incoming = req.headers['x-request-id'];
  const requestId = incoming ? sanitizeRequestId(String(incoming)) : randomUUID();

  const request = req as RequestWithLog;
  request.requestId = requestId;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const log = logger.child({ requestId });
  request.log = log;

  res.on('finish', () => {
    log.info(
      { method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start },
      'request complete',
    );
  });

  next();
}
