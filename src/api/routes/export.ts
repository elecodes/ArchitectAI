import { Router } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import * as projectRepo from '../../db/repositories/project-repo.js';
import { listArtifacts } from '../../db/repositories/artifact-repo.js';
import { createDocumentStore } from '../../storage/factory.js';
import { buildPackageZip, storeExportPackage } from '../../storage/export-service.js';
import { config } from '../../config/index.js';
import { createChildLogger } from '../../logger.js';
import { exportLimiter } from '../middleware/rate-limiter.js';

const log = createChildLogger('export-api');
const router = Router();

function notFound(res: { status: (code: number) => { json: (body: unknown) => void } }, message: string) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message } });
}

// POST /api/export/:projectId — assemble + store the engineering package
router.post('/:projectId', exportLimiter, authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const project = await projectRepo.getProject(String(req.params.projectId), req.userId!);
    if (!project) {
      notFound(res, 'Project not found');
      return;
    }

    const artifacts = await listArtifacts(project.id, req.userId!);
    const zip = await buildPackageZip({
      projectName: project.name,
      description: project.description || undefined,
      artifacts,
    });

    const store = createDocumentStore(config);
    const result = await storeExportPackage(store, project.id, zip);

    log.info(
      { projectId: project.id, key: result.key, sizeBytes: result.sizeBytes },
      'engineering package stored',
    );
    res.status(201).json({
      export: {
        storageProvider: config.storageProvider,
        key: result.key,
        sizeBytes: result.sizeBytes,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/export/:projectId/latest — download the most recently stored package
router.get('/:projectId/latest', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const project = await projectRepo.getProject(String(req.params.projectId), req.userId!);
    if (!project) {
      notFound(res, 'Project not found');
      return;
    }

    const store = createDocumentStore(config);
    const objects = await store.listObjects(`exports/${project.id}/`);
    if (objects.length === 0) {
      notFound(res, 'No engineering package stored for this project');
      return;
    }

    const latest = [...objects].sort().at(-1)!;
    const data = await store.getObject(latest);
    if (!data) {
      notFound(res, 'Stored package could not be read');
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${project.name.replace(/\s+/g, '_')}.zip"`,
    );
    res.send(data);
  } catch (err) {
    next(err);
  }
});

export const exportRouter = router;
