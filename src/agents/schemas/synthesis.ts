import { z } from 'zod';

export const SynthesisSchema = z.object({
  executiveSummary: z.string(),
  coherentPlan: z.object({
    requirements: z.string(),
    architecture: z.string(),
    security: z.string(),
    cloudCost: z.string(),
    devsecops: z.string(),
    testStrategy: z.string(),
  }),
  risks: z.array(z.string()),
  assumptions: z.array(z.string()),
  decisions: z.array(z.string()),
  prioritizedTasks: z.array(z.object({
    task: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    dependencies: z.array(z.string()),
    estimatedEffort: z.string().optional(),
  })),
  openQuestions: z.array(z.string()).optional(),
});

export type SynthesisOutput = z.infer<typeof SynthesisSchema>;
