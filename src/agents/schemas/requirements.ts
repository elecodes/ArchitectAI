import { z } from 'zod';

const StringArrayTransform = z.array(z.any()).transform((arr): string[] =>
  arr.map((item) =>
    typeof item === 'object' && item !== null
      ? (item as any).description || (item as any).risk || (item as any).assumption || JSON.stringify(item)
      : String(item)
  )
);

export const RequirementsSchema = z.object({
  clarifiedRequirements: z.string().describe('High-level summary of clarified requirements'),
  functionalRequirements: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      priority: z.enum(['must', 'should', 'could']),
    })
  ).min(1),
  nonFunctionalRequirements: z.array(
    z.object({
      category: z.string(),
      description: z.string(),
      metric: z.string().optional(),
    })
  ),
  assumptions: StringArrayTransform,
  risks: StringArrayTransform,
  acceptanceCriteria: z.array(z.string()),
});

export type RequirementsOutput = z.infer<typeof RequirementsSchema>;
