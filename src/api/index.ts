import express from 'express';
import cors from 'cors';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { generationRouter } from './routes/generation.js';
import { artifactsRouter } from './routes/artifacts.js';
import { feedbackRouter } from './routes/feedback.js';
import { reviewRouter } from './routes/review.js';
import { exportRouter } from './routes/export.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { generalLimiter, generationLimiter } from './middleware/rate-limiter.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors({ origin: 'http://localhost:3000' }));
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting
  app.use(generalLimiter);
  app.use('/api/specs', generationLimiter);
  app.use('/api/architecture', generationLimiter);
  app.use('/api/tasks', generationLimiter);
  app.use('/api/vision', generationLimiter);
  app.use('/api/risks', generationLimiter);
  app.use('/api/diagrams', generationLimiter);

  // Public routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);

  // Protected routes
  app.use('/api/projects', projectsRouter);
  app.use('/api', generationRouter);
  app.use('/api', reviewRouter);
  app.use('/api/export', exportRouter);
  app.use('/api/artifacts', artifactsRouter);
  app.use('/api/artifacts', feedbackRouter);

  // Serve frontend static files in production
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const publicDir = join(__dirname, '..', 'public');
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // SPA fallback — serve index.html for non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(publicDir, 'index.html'));
    });
  }

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
