import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Missing token' } });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') {
      res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Token expired' } });
      return;
    }
    res.status(401).json({ error: { code: 'AUTH_ERROR', message: 'Invalid token' } });
  }
}
