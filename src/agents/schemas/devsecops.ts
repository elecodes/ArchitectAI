import { z } from 'zod';

export const DevSecOpsSchema = z.object({
  cicdPipeline: z.string().describe('CI/CD pipeline design description'),
  stages: z.array(z.object({
    name: z.string(),
    description: z.string(),
    tools: z.array(z.string()),
  })),
  dockerConfig: z.string().describe('Docker/container configuration guidance'),
  deploymentStrategy: z.string(),
  securityAutomation: z.array(z.string()),
  monitoring: z.array(z.string()).optional(),
  operationalNotes: z.array(z.string()),
});

export type DevSecOpsOutput = z.infer<typeof DevSecOpsSchema>;
