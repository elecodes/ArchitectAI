import { z } from 'zod';

export const SecuritySchema = z.object({
  threats: z.array(z.object({
    threat: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    mitigation: z.string(),
    owaspCategory: z.string().optional(),
  })),
  controls: z.array(z.string()).describe('Security controls to implement'),
  authentication: z.string().describe('Recommended auth approach'),
  authorization: z.string().describe('Recommended authz approach'),
  dataProtection: z.array(z.string()).optional(),
  recommendations: z.array(z.string()),
});

export type SecurityOutput = z.infer<typeof SecuritySchema>;
