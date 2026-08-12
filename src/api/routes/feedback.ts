import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { getPool } from '../../db/connection.js';
import { getArtifact } from '../../db/repositories/artifact-repo.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('feedback-api');
const router = Router();

const FeedbackSchema = z.object({
  rating: z.enum(['helpful', 'needs_improvement']),
  comment: z.string().max(1000).optional(),
});

router.post('/:id/feedback', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const input = FeedbackSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: input.error.issues.map(i => i.message).join('; ') } });
      return;
    }

    const pool = getPool();

    const artifact = await getArtifact(req.params.id as string, req.userId!);
    if (!artifact) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artifact not found' } });
      return;
    }

    // Upsert: one feedback per user per artifact
    await pool.query(
      `INSERT INTO artifact_feedback (artifact_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (artifact_id, user_id) DO UPDATE SET rating = $3, comment = $4`,
      [req.params.id as string, req.userId!, input.data.rating, input.data.comment || null],
    );

    res.status(201).json({ success: true });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to submit feedback');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to submit feedback' } });
  }
});

export { router as feedbackRouter };
