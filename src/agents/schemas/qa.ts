import { z } from 'zod';

export const QASchema = z.object({
  testStrategy: z.string(),
  testLevels: z.array(z.object({
    level: z.enum(['unit', 'integration', 'e2e', 'performance']),
    description: z.string(),
    coverage: z.string(),
  })),
  testCases: z.array(z.object({
    name: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    type: z.enum(['unit', 'integration', 'e2e']),
  })),
  edgeCases: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  qualityRisks: z.array(z.object({
    risk: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    mitigation: z.string(),
  })),
});

export type QAOutput = z.infer<typeof QASchema>;
