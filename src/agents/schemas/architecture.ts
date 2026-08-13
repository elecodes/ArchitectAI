import { z } from 'zod';

export const ArchitectureSchema = z.object({
  components: z.array(z.object({
    name: z.string(),
    description: z.string(),
    responsibilities: z.array(z.string()),
    interfaces: z.array(z.string()).optional(),
  })).min(1),
  dataFlow: z.string().describe('Description of data flow between components'),
  techDecisions: z.array(z.object({
    decision: z.string(),
    rationale: z.string(),
    alternatives: z.array(z.string()).optional(),
  })).min(1),
  rationale: z.string().describe('Overall architectural rationale'),
  tradeoffs: z.array(z.string()).optional(),
});

export type ArchitectureOutput = z.infer<typeof ArchitectureSchema>;
