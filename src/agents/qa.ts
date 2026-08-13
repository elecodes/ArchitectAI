import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { QASchema, type QAOutput } from './schemas/qa.js';
import { RequirementsSchema } from './schemas/requirements.js';
import { ArchitectureSchema } from './schemas/architecture.js';
import { registerAgent } from './registry.js';

const QAInputSchema = z.object({
  requirements: RequirementsSchema,
  architecture: ArchitectureSchema,
});

type QAInput = z.infer<typeof QAInputSchema>;

export const qaAgent: AgentDefinition<QAInput, QAOutput> = {
  id: 'qa',
  name: 'QA Agent',
  description: 'Designs test strategy, test cases, and quality risk analysis',
  promptName: 'qa',
  artifactType: 'test_strategy',
  inputSchema: QAInputSchema,
  outputSchema: QASchema,
  capabilities: ['rag:read', 'artifact:read:requirements', 'artifact:read:agent_architecture'],
  timeoutMs: 30_000,
  maxTransientRetries: 2,
};

registerAgent(qaAgent);
