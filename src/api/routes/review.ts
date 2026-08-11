import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { ReviewPipeline } from '../../review/pipeline.js';
import { createLLMClient } from '../../llm/factory.js';
import { config } from '../../config/index.js';
import { loadPrompts } from '../../prompts/loader.js';
import { createChildLogger } from '../../logger.js';
import { resolveFsPath, PathContainmentError } from '../../utils/path-safety.js';
import type { RequestWithLog } from '../middleware/request-id.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const log = createChildLogger('review-api');
const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

let reviewPipeline: ReviewPipeline | null = null;

function getPipeline(): ReviewPipeline {
  if (!reviewPipeline) {
    const llm = createLLMClient(config);
    const promptsDir = join(__dirname, '..', '..', 'prompts');
    const prompts = loadPrompts(promptsDir);
    reviewPipeline = new ReviewPipeline(llm, prompts, config.llmModel, config.llmContextWindow);
  }
  return reviewPipeline;
}

const ReviewRequestSchema = z.object({
  path: z.string().min(1, 'Repository path is required'),
  customIgnore: z.array(z.string()).optional(),
});

router.post('/review', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = ReviewRequestSchema.safeParse(req.body);
  if (!input.success) {
    res
      .status(400)
      .json({
        error: {
          code: 'VALIDATION_ERROR',
          message: input.error.issues.map((i) => i.message).join('; '),
        },
      });
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

  try {
    log.info(
      { path: resolvedPath.slice(0, 500), userId: req.userId, requestId: (req as RequestWithLog).requestId },
      'Starting repository review',
    );
    const result = await getPipeline().review({
      path: resolvedPath,
      customIgnore: input.data.customIgnore,
    });

    // Don't include full file contents in response (too large)
    const response = {
      repository: {
        rootPath: result.repository.rootPath,
        totalFiles: result.repository.totalFiles,
        totalLines: result.repository.totalLines,
        totalSizeBytes: result.repository.totalSizeBytes,
        extensions: result.repository.extensions,
        skippedCount: result.repository.skipped.length,
      },
      technology: result.technology,
      summary: result.summary,
      review: result.review,
      improvements: result.improvements,
      provenance: result.provenance,
    };

    log.info(
      { files: result.repository.totalFiles, durationMs: result.provenance.totalDurationMs },
      'Review complete',
    );
    res.status(200).json(response);
  } catch (err) {
    log.error(
      { err: (err as Error).message, requestId: (req as RequestWithLog).requestId },
      'Review failed',
    );
    res
      .status(500)
      .json({ error: { code: 'REVIEW_FAILED', message: 'Review failed. Please try again.' } });
  }
});

export { router as reviewRouter };
