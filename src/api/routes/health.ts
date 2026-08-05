import { Router } from 'express';
import { getPool } from '../../db/connection.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const components: Record<string, { status: string; message?: string }> = {};

  // Database check
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    components.database = { status: 'healthy' };
  } catch (err) {
    components.database = { status: 'unhealthy', message: (err as Error).message };
  }

  // LLM check (placeholder — will check actual provider in Sprint 2)
  components.llm = { status: 'healthy', message: 'Provider configured' };

  const overallHealthy = Object.values(components).every(c => c.status === 'healthy');

  res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? 'healthy' : 'unhealthy',
    components,
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter };
