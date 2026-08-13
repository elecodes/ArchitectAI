import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { SynthesisSchema, type SynthesisOutput } from './schemas/synthesis.js';
import { RequirementsSchema } from './schemas/requirements.js';
import { ArchitectureSchema } from './schemas/architecture.js';
import { SecuritySchema } from './schemas/security.js';
import { CloudCostSchema } from './schemas/cloud-cost.js';
import { DevSecOpsSchema } from './schemas/devsecops.js';
import { QASchema } from './schemas/qa.js';
import { registerAgent } from './registry.js';

const SynthesisInputSchema = z.object({
  requirements: RequirementsSchema,
  architecture: ArchitectureSchema,
  security: SecuritySchema,
  cloudCost: CloudCostSchema,
  devsecops: DevSecOpsSchema,
  qa: QASchema,
});

type SynthesisInput = z.infer<typeof SynthesisInputSchema>;

export const synthesisAgent: AgentDefinition<SynthesisInput, SynthesisOutput> = {
  id: 'synthesis',
  name: 'Synthesis Agent',
  description: 'Combines all agent outputs into a coherent workflow package',
  promptName: 'synthesis',
  artifactType: 'synthesis',
  inputSchema: SynthesisInputSchema,
  outputSchema: SynthesisSchema,
  capabilities: ['rag:read', 'artifact:read:requirements', 'artifact:read:agent_architecture', 'artifact:read:security_analysis', 'artifact:read:cloud_cost_analysis', 'artifact:read:devsecops_analysis', 'artifact:read:test_strategy'],
  timeoutMs: 60_000,
  maxTransientRetries: 2,
};

registerAgent(synthesisAgent);
