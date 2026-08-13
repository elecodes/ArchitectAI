import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { DevSecOpsSchema, type DevSecOpsOutput } from './schemas/devsecops.js';
import { ArchitectureSchema } from './schemas/architecture.js';
import { SecuritySchema } from './schemas/security.js';
import { registerAgent } from './registry.js';

const DevSecOpsInputSchema = z.object({
  architecture: ArchitectureSchema,
  security: SecuritySchema,
});

type DevSecOpsInput = z.infer<typeof DevSecOpsInputSchema>;

export const devsecopsAgent: AgentDefinition<DevSecOpsInput, DevSecOpsOutput> = {
  id: 'devsecops',
  name: 'DevSecOps Agent',
  description: 'Designs CI/CD pipeline, deployment, and security automation',
  promptName: 'devsecops',
  artifactType: 'devsecops_analysis',
  inputSchema: DevSecOpsInputSchema,
  outputSchema: DevSecOpsSchema,
  capabilities: ['rag:read', 'artifact:read:agent_architecture', 'artifact:read:security_analysis'],
  timeoutMs: 30_000,
  maxTransientRetries: 2,
};

registerAgent(devsecopsAgent);
