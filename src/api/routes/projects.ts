import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import * as projectRepo from '../../db/repositories/project-repo.js';
import { RAGIndexer } from '../../rag/indexer.js';
import { createEmbeddingClient } from '../../llm/factory.js';
import { config } from '../../config/index.js';
import { getPool } from '../../db/connection.js';
import { createChildLogger } from '../../logger.js';
import { resolveFsPath, PathContainmentError } from '../../utils/path-safety.js';
import { indexLimiter } from '../middleware/rate-limiter.js';
import type { RequestWithLog } from '../middleware/request-id.js';

const log = createChildLogger('projects-api');
const router = Router();

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

const IndexProjectSchema = z.object({
  path: z.string().min(1),
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const input = CreateProjectSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: input.error.message } });
      return;
    }
    const project = await projectRepo.createProject(req.userId!, input.data.name, input.data.description);
    res.status(201).json(project);
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to create project');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create project' } });
  }
});

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const projects = await projectRepo.listProjects(req.userId!);
    res.json(projects);
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to list projects');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list projects' } });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectRepo.getProject(req.params.id as string, req.userId!);
    if (!project) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    res.json(project);
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to get project');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get project' } });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = await projectRepo.deleteProject(req.params.id as string, req.userId!);
    if (!deleted) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }
    res.status(204).send();
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to delete project');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete project' } });
  }
});

router.post('/:id/index', indexLimiter, authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const project = await projectRepo.getProject(req.params.id as string, req.userId!);
    if (!project) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const input = IndexProjectSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'path is required' } });
      return;
    }

    let resolvedPath: string;
    try {
      resolvedPath = resolveFsPath(input.data.path);
    } catch (err) {
      if (err instanceof PathContainmentError) {
        res
          .status(400)
          .json({ error: { code: 'PATH_NOT_ALLOWED', message: 'Path is outside the allowed root' } });
        return;
      }
      throw err;
    }

    const embeddingClient = createEmbeddingClient(config);
    const indexer = new RAGIndexer(getPool(), embeddingClient);
    const result = await indexer.indexProject(project.id, resolvedPath, config.maxIndexFiles);

    log.info(
      { projectId: project.id, requestId: (req as RequestWithLog).requestId, ...result },
      'Project indexed',
    );
    res.json(result);
  } catch (err) {
    log.error(
      { err: (err as Error).message, requestId: (req as RequestWithLog).requestId },
      'Failed to index project',
    );
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to index project' } });
  }
});

export { router as projectsRouter };
