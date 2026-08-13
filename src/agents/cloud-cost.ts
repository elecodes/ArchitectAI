import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { CloudCostSchema, type CloudCostOutput } from './schemas/cloud-cost.js';
import { ArchitectureSchema } from './schemas/architecture.js';
import { RequirementsSchema } from './schemas/requirements.js';
import { registerAgent } from './registry.js';

const CloudCostInputSchema = z.object({
  architecture: ArchitectureSchema,
  requirements: RequirementsSchema,
});

type CloudCostInput = z.infer<typeof CloudCostInputSchema>;

export const cloudCostAgent: AgentDefinition<CloudCostInput, CloudCostOutput> = {
  id: 'cloud-cost',
  name: 'Cloud Cost Agent',
  description: 'Evaluates deployment architecture, cloud recommendations, and cost estimates',
  promptName: 'cloud-cost',
  artifactType: 'cloud_cost_analysis',
  inputSchema: CloudCostInputSchema,
  outputSchema: CloudCostSchema,
  capabilities: ['rag:read', 'artifact:read:agent_architecture', 'artifact:read:requirements'],
  timeoutMs: 30_000,
  maxTransientRetries: 2,
};

registerAgent(cloudCostAgent);
