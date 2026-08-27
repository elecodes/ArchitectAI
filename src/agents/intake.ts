import { z } from 'zod';
import { AgentDefinition } from './contract.js';
import { IntakeOutputSchema, type IntakeOutput } from './schemas/intake.js';
import { registerAgent } from './registry.js';

const IntakeInputSchema = z.object({
  idea: z.string().min(3, 'Idea must be at least 3 characters'),
  context: z.string().optional(),
});

type IntakeInput = z.infer<typeof IntakeInputSchema>;

export const intakeAgent: AgentDefinition<IntakeInput, IntakeOutput> = {
  id: 'intake',
  name: 'Phase 0 Intake Agent (Grill Me)',
  description: 'Audits input prompt for architectural ambiguity and generates probing intake questions',
  promptName: 'intake',
  artifactType: 'intake',
  inputSchema: IntakeInputSchema,
  outputSchema: IntakeOutputSchema,
  capabilities: ['rag:read'],
  timeoutMs: 120_000,
  maxTransientRetries: 2,
};

registerAgent(intakeAgent);
