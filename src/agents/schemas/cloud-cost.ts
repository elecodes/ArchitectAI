import { z } from 'zod';

export const CloudCostSchema = z.object({
  deploymentArchitecture: z.string(),
  awsRecommendations: z.array(z.object({
    service: z.string(),
    useCase: z.string(),
    estimatedMonthlyCost: z.string(),
    freeTierEligible: z.boolean().optional(),
  })),
  totalEstimatedMonthlyCost: z.string(),
  freeTierAlternatives: z.array(z.string()),
  localAlternatives: z.array(z.string()).describe('Local/self-hosted alternatives to cloud services'),
  optimizationTips: z.array(z.string()).optional(),
});

export type CloudCostOutput = z.infer<typeof CloudCostSchema>;
