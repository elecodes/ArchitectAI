import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({ origin: 'http://localhost:3000' }));
  app.use(express.json({ limit: '1mb' }));

  // Public routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
