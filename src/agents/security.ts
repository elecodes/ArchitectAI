import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { SecuritySchema, type SecurityOutput } from './schemas/security.js';
import { RequirementsSchema } from './schemas/requirements.js';
import { ArchitectureSchema } from './schemas/architecture.js';
import { registerAgent } from './registry.js';

const SecurityInputSchema = z.object({
  requirements: RequirementsSchema,
  architecture: ArchitectureSchema,
});

type SecurityInput = z.infer<typeof SecurityInputSchema>;

export const securityAgent: AgentDefinition<SecurityInput, SecurityOutput> = {
  id: 'security',
  name: 'Security Agent',
  description: 'Analyzes threats, controls, and OWASP items for the architecture',
  promptName: 'security',
  artifactType: 'security_analysis',
  inputSchema: SecurityInputSchema,
  outputSchema: SecuritySchema,
  capabilities: ['rag:read', 'artifact:read:requirements', 'artifact:read:agent_architecture'],
  timeoutMs: 30_000,
  maxTransientRetries: 2,
};

registerAgent(securityAgent);
