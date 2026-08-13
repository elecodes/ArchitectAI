import { z } from 'zod';

export const RequirementsSchema = z.object({
  clarifiedRequirements: z.string().describe('High-level summary of clarified requirements'),
  functionalRequirements: z.array(z.object({
    id: z.string(),
    description: z.string(),
    priority: z.enum(['must', 'should', 'could']),
  })).min(1),
  nonFunctionalRequirements: z.array(z.object({
    category: z.string(),
    description: z.string(),
    metric: z.string().optional(),
  })),
  assumptions: z.array(z.string()),
  risks: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
});

export type RequirementsOutput = z.infer<typeof RequirementsSchema>;
