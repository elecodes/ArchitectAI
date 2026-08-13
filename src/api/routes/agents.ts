import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listAgentDefinitions } from '../../agents/registry.js';

const router = Router();

router.get('/', authMiddleware, async (_req, res) => {
  const agents = listAgentDefinitions().map(def => ({
    id: def.id,
    name: def.name,
    description: def.description,
    capabilities: def.capabilities,
    timeoutMs: def.timeoutMs,
  }));
  res.json({ agents });
});

export { router as agentsRouter };
