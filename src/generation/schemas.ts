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

const RawComponentDefSchema = z.object({
  name: z.string().min(1),
  layer: z.enum(['domain', 'application', 'interface', 'infrastructure']),
  responsibilities: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string()),
});

export const ComponentDefSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    const validLayers = ['domain', 'application', 'interface', 'infrastructure'];
    if (!obj.layer || !validLayers.includes(String(obj.layer).toLowerCase())) {
      obj.layer = 'application';
    } else {
      obj.layer = String(obj.layer).toLowerCase();
    }
    if (!Array.isArray(obj.responsibilities)) {
      obj.responsibilities = typeof obj.responsibilities === 'string' ? [obj.responsibilities] : ['Component responsibility'];
    }
    if (!Array.isArray(obj.dependencies)) {
      obj.dependencies = [];
    }
    return obj;
  },
  RawComponentDefSchema
) as unknown as typeof RawComponentDefSchema;

export const DependencyEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export const BoundedContextSchema = z.object({
  name: z.string().min(1),
  aggregates: z.array(z.string().min(1)).min(1),
  responsibilities: z.array(z.string().min(1)).min(1),
});

const RawArchitectureDocumentSchema = z.object({
  components: z.array(ComponentDefSchema).min(1),
  dependencyGraph: z.array(DependencyEdgeSchema),
  boundedContexts: z.array(BoundedContextSchema).min(1),
  solidNotes: z.array(z.string()),
});

export const ArchitectureDocumentSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };

    if (!obj.dependencyGraph && obj.dependency_graph) obj.dependencyGraph = obj.dependency_graph;
    if (!obj.boundedContexts && obj.bounded_contexts) obj.boundedContexts = obj.bounded_contexts;
    if (!obj.solidNotes && obj.solid_notes) obj.solidNotes = obj.solid_notes;

    if (!Array.isArray(obj.dependencyGraph)) obj.dependencyGraph = [];
    if (!Array.isArray(obj.boundedContexts) || obj.boundedContexts.length === 0) {
      obj.boundedContexts = (Array.isArray(obj.components) ? obj.components : []).map((c: any) => ({
        name: c?.name || 'Main Context',
        aggregates: [c?.name || 'Core Aggregate'],
        responsibilities: Array.isArray(c?.responsibilities) ? c.responsibilities : ['Core Domain Responsibility'],
      }));
      if (obj.boundedContexts.length === 0) {
        obj.boundedContexts = [{ name: 'Core System', aggregates: ['SystemAggregate'], responsibilities: ['Main System Operations'] }];
      }
    }
    if (!Array.isArray(obj.solidNotes)) obj.solidNotes = [];
    return obj;
  },
  RawArchitectureDocumentSchema
) as unknown as typeof RawArchitectureDocumentSchema;

export type ArchitectureDocument = z.infer<typeof RawArchitectureDocumentSchema>;

// --- Task Breakdown Schema ---

export const AcceptanceCriterionSchema = z.object({
  action: z.string().min(1),
  expectedResult: z.string().min(1),
  passFailCondition: z.string().min(1),
});

const RawTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  complexity: z.number().int().min(1).max(5),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1).max(10),
  dependsOn: z.array(z.string()),
});

export const TaskSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    if (!obj.acceptanceCriteria && obj.acceptance_criteria) obj.acceptanceCriteria = obj.acceptance_criteria;
    if (!obj.dependsOn && obj.depends_on) obj.dependsOn = obj.depends_on;
    if (typeof obj.complexity === 'string') obj.complexity = parseInt(obj.complexity, 10) || 3;
    if (!Array.isArray(obj.dependsOn)) obj.dependsOn = [];
    if (!Array.isArray(obj.acceptanceCriteria)) {
      obj.acceptanceCriteria = [{ action: 'Execute task', expectedResult: 'Task completes successfully', passFailCondition: 'Output is verified' }];
    } else {
      obj.acceptanceCriteria = obj.acceptanceCriteria.map((ac: any) => {
        if (typeof ac === 'string') return { action: 'Execute task', expectedResult: ac, passFailCondition: 'Verified' };
        return ac;
      });
    }
    return obj;
  },
  RawTaskSchema
) as unknown as typeof RawTaskSchema;

const RawTaskBreakdownSchema = z.object({
  tasks: z.array(TaskSchema).min(1),
  dependencyOrder: z.array(z.array(z.string())),
  traceabilityCoverage: z.number().min(0).max(100),
});

export const TaskBreakdownSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    if (!obj.dependencyOrder && obj.dependency_order) obj.dependencyOrder = obj.dependency_order;
    if (!obj.traceabilityCoverage && obj.traceability_coverage !== undefined) obj.traceabilityCoverage = obj.traceability_coverage;

    if (!Array.isArray(obj.dependencyOrder)) {
      const taskIds = (Array.isArray(obj.tasks) ? obj.tasks : []).map((t: any) => t.id || 'TASK-1');
      obj.dependencyOrder = [taskIds];
    }
    if (typeof obj.traceabilityCoverage !== 'number') {
      obj.traceabilityCoverage = parseFloat(obj.traceabilityCoverage) || 100;
    }
    return obj;
  },
  RawTaskBreakdownSchema
) as unknown as typeof RawTaskBreakdownSchema;

export type TaskBreakdown = z.infer<typeof RawTaskBreakdownSchema>;

// --- Product Vision Schema ---

export const ProductVisionSchema = z.object({
  vision: z.string().min(1),
  problem: z.string().min(1),
  targetUsers: z.array(z.string().min(1)).min(1),
  businessGoals: z.array(z.string().min(1)).min(1),
  coreCapabilities: z.array(z.string().min(1)).min(1),
  successMetrics: z.array(z.string().min(1)).min(1),
  mvpBoundaries: z.object({
    included: z.array(z.string()),
    excluded: z.array(z.string()),
  }),
});

export type ProductVision = z.infer<typeof ProductVisionSchema>;

// --- Risk Assessment Schema ---

const RawRiskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  category: z.enum([
    'architecture',
    'security',
    'data',
    'ai_llm',
    'infrastructure',
    'performance',
    'operational',
    'compliance',
  ]),
  probability: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  mitigation: z.string().min(1),
  status: z.enum(['identified', 'mitigated', 'accepted', 'monitoring']),
});

export const RiskSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    const validCats = ['architecture', 'security', 'data', 'ai_llm', 'infrastructure', 'performance', 'operational', 'compliance'];
    if (!obj.category || !validCats.includes(String(obj.category).toLowerCase())) obj.category = 'architecture';
    else obj.category = String(obj.category).toLowerCase();

    const validLevels = ['low', 'medium', 'high'];
    if (!obj.probability || !validLevels.includes(String(obj.probability).toLowerCase())) obj.probability = 'medium';
    else obj.probability = String(obj.probability).toLowerCase();

    if (!obj.impact || !validLevels.includes(String(obj.impact).toLowerCase())) obj.impact = 'medium';
    else obj.impact = String(obj.impact).toLowerCase();

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!obj.severity || !validSeverities.includes(String(obj.severity).toLowerCase())) obj.severity = 'medium';
    else obj.severity = String(obj.severity).toLowerCase();

    const validStatuses = ['identified', 'mitigated', 'accepted', 'monitoring'];
    if (!obj.status || !validStatuses.includes(String(obj.status).toLowerCase())) obj.status = 'identified';
    else obj.status = String(obj.status).toLowerCase();

    return obj;
  },
  RawRiskSchema
) as unknown as typeof RawRiskSchema;

export const RiskAssessmentSchema = z.object({
  risks: z.array(RiskSchema).min(1).max(15),
});

export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;
