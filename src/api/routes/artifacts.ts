import { Router } from 'express';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import * as artifactRepo from '../../db/repositories/artifact-repo.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('artifacts-api');
const router = Router();

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const artifact = await artifactRepo.getArtifact(req.params.id as string, req.userId!);
    if (!artifact) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
      return;
    }
    res.json(artifact);
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to get artifact');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get artifact' } });
  }
});

export { router as artifactsRouter };
