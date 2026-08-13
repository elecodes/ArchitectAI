import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { ArchitectureSchema, type ArchitectureOutput } from './schemas/architecture.js';
import { RequirementsSchema, type RequirementsOutput } from './schemas/requirements.js';
import { registerAgent } from './registry.js';

const ArchitectureInputSchema = z.object({
  requirements: RequirementsSchema,
  projectContext: z.string().optional(),
});

type ArchitectureInput = z.infer<typeof ArchitectureInputSchema>;

export const architectureAgent: AgentDefinition<ArchitectureInput, ArchitectureOutput> = {
  id: 'agent-architecture',
  name: 'Architecture Agent',
  description: 'Designs system architecture based on clarified requirements',
  promptName: 'agent-architecture',
  artifactType: 'agent_architecture',
  inputSchema: ArchitectureInputSchema,
  outputSchema: ArchitectureSchema,
  capabilities: ['rag:read', 'artifact:read:requirements'],
  timeoutMs: 30_000,
  maxTransientRetries: 2,
};

registerAgent(architectureAgent);
