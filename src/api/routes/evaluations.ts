import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthenticatedRequest } from '../middleware/auth.js';
import { getPool } from '../../db/connection.js';
import { BenchmarkRunner } from '../../llm/benchmark-runner.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('evaluations-api');
const router = Router();

const StartBenchmarkSchema = z.object({
  agentId: z.string(),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  datasetVersion: z.string().default('1.0.0'),
});

// GET /api/evaluations/datasets
router.get('/datasets', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Return dataset info
    res.json({
      datasets: [
        {
          version: '1.0.0',
          name: 'Golden Evaluation Dataset',
          description: '5 representative software ideas covering different domains and complexity levels.',
          casesCount: 5,
        }
      ]
    });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to fetch datasets');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch datasets' } });
  }
});

// GET /api/evaluations/runs
router.get('/runs', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: runs } = await pool.query(
      `SELECT r.*, 
       (SELECT COUNT(*) FROM evaluation_results WHERE run_id = r.id) as case_count,
       (SELECT AVG(score) FROM evaluation_results WHERE run_id = r.id) as avg_score
       FROM evaluation_runs r 
       ORDER BY r.timestamp DESC`
    );
    res.json({ runs });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to fetch runs');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch runs' } });
  }
});

// GET /api/evaluations/runs/:id
router.get('/runs/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const pool = getPool();
    const { rows: runs } = await pool.query('SELECT * FROM evaluation_runs WHERE id = $1', [req.params.id]);
    if (runs.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Run not found' } });
      return;
    }

    const { rows: results } = await pool.query(
      `SELECT * FROM evaluation_results WHERE run_id = $1 ORDER BY case_id ASC`,
      [req.params.id]
    );

    res.json({ run: runs[0], results });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to fetch run details');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch run details' } });
  }
});

// POST /api/evaluations/benchmark
router.post('/benchmark', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const input = StartBenchmarkSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: input.error.issues.map(i => i.message).join('; ') } });
    return;
  }

  try {
    const runner = new BenchmarkRunner(getPool());
    // Start benchmark run asynchronously
    runner.run({
      agentId: input.data.agentId,
      provider: input.data.provider,
      model: input.data.model,
      promptVersion: input.data.promptVersion,
      datasetVersion: input.data.datasetVersion,
    }).catch(err => {
      log.error({ err: (err as Error).message }, 'Asynchronous benchmark run failed');
    });

    res.status(202).json({ message: 'Benchmark run started' });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to start benchmark');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to start benchmark' } });
  }
});

// GET /api/evaluations/leaderboard
router.get('/leaderboard', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { agentId, provider, model, promptVersion, datasetVersion } = req.query;
    const pool = getPool();

    let query = `
      SELECT 
        r.agent_id,
        r.provider,
        r.model,
        r.prompt_version,
        run.dataset_version,
        AVG(r.score)::numeric(3,1) as avg_score,
        AVG(r.latency_ms)::integer as avg_latency_ms,
        AVG(r.prompt_tokens + r.completion_tokens)::integer as avg_tokens,
        (COUNT(*) FILTER (WHERE NOT r.validation_success)::double precision / COUNT(*)) * 100 as failure_rate,
        COUNT(*) as total_cases
      FROM evaluation_results r
      JOIN evaluation_runs run ON r.run_id = run.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (agentId) {
      params.push(agentId as string);
      query += ` AND r.agent_id = $${params.length}`;
    }
    if (provider) {
      params.push(provider as string);
      query += ` AND r.provider = $${params.length}`;
    }
    if (model) {
      params.push(model as string);
      query += ` AND r.model = $${params.length}`;
    }
    if (promptVersion) {
      params.push(promptVersion as string);
      query += ` AND r.prompt_version = $${params.length}`;
    }
    if (datasetVersion) {
      params.push(datasetVersion as string);
      query += ` AND run.dataset_version = $${params.length}`;
    }

    query += `
      GROUP BY r.agent_id, r.provider, r.model, r.prompt_version, run.dataset_version
      ORDER BY avg_score DESC
    `;

    const { rows: leaderboard } = await pool.query(query, params);
    res.json({ leaderboard });
  } catch (err) {
    log.error({ err: (err as Error).message }, 'Failed to fetch leaderboard');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch leaderboard' } });
  }
});

export { router as evaluationsRouter };
