import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { generationRouter } from './routes/generation.js';
import { artifactsRouter } from './routes/artifacts.js';
import { feedbackRouter } from './routes/feedback.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({ origin: 'http://localhost:3000' }));
  app.use(express.json({ limit: '1mb' }));

  // Public routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);

  // Protected routes
  app.use('/api/projects', projectsRouter);
  app.use('/api', generationRouter);
  app.use('/api/artifacts', artifactsRouter);
  app.use('/api/artifacts', feedbackRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
