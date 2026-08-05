import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('error-handler');

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  log.error({ err: err.message, code, statusCode, stack: err.stack }, 'Request error');

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(err.details && { details: err.details }),
    },
  });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
  });
}
