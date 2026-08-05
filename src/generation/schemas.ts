import { z } from 'zod';

// --- Specification Schema ---

export const RequirementSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['must', 'should', 'could']),
});

export const SpecificationSchema = z.object({
  functionalRequirements: z.array(RequirementSchema).min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  constraints: z.array(z.string()),
  dependencies: z.array(z.string()),
});

export type Specification = z.infer<typeof SpecificationSchema>;

// --- Architecture Document Schema ---

export const ComponentDefSchema = z.object({
  name: z.string().min(1),
  layer: z.enum(['domain', 'application', 'interface', 'infrastructure']),
  responsibilities: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string()),
});

export const DependencyEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export const BoundedContextSchema = z.object({
  name: z.string().min(1),
  aggregates: z.array(z.string().min(1)).min(1),
  responsibilities: z.array(z.string().min(1)).min(1),
});

export const ArchitectureDocumentSchema = z.object({
  components: z.array(ComponentDefSchema).min(1),
  dependencyGraph: z.array(DependencyEdgeSchema),
  boundedContexts: z.array(BoundedContextSchema).min(1),
  solidNotes: z.array(z.string()),
});

export type ArchitectureDocument = z.infer<typeof ArchitectureDocumentSchema>;

// --- Task Breakdown Schema ---

export const AcceptanceCriterionSchema = z.object({
  action: z.string().min(1),
  expectedResult: z.string().min(1),
  passFailCondition: z.string().min(1),
});

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  complexity: z.number().int().min(1).max(5),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1).max(10),
  dependsOn: z.array(z.string()),
});

export const TaskBreakdownSchema = z.object({
  tasks: z.array(TaskSchema).min(1),
  dependencyOrder: z.array(z.array(z.string())),
  traceabilityCoverage: z.number().min(0).max(100),
});

export type TaskBreakdown = z.infer<typeof TaskBreakdownSchema>;
