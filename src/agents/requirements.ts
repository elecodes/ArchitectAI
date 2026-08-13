import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { RequirementsSchema, type RequirementsOutput } from './schemas/requirements.js';
import { registerAgent } from './registry.js';

const RequirementsInputSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  context: z.string().optional(),
});

type RequirementsInput = z.infer<typeof RequirementsInputSchema>;

export const requirementsAgent: AgentDefinition<RequirementsInput, RequirementsOutput> = {
  id: 'requirements',
  name: 'Requirements Agent',
  description: 'Clarifies and structures project requirements from a high-level idea',
  promptName: 'requirements',
  artifactType: 'requirements',
  inputSchema: RequirementsInputSchema,
  outputSchema: RequirementsSchema,
  capabilities: ['rag:read'],
  timeoutMs: 30_000,
  maxTransientRetries: 2,
};

registerAgent(requirementsAgent);
