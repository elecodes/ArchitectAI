import { z } from 'zod';

const RawTestCaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  type: z.enum(['unit', 'integration', 'e2e', 'performance', 'security', 'smoke']),
});

export const TestCaseSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    const validTypes = ['unit', 'integration', 'e2e', 'performance', 'security', 'smoke'];
    if (!obj.type || !validTypes.includes(String(obj.type).toLowerCase())) {
      obj.type = 'integration';
    } else {
      obj.type = String(obj.type).toLowerCase();
    }
    const validPriorities = ['low', 'medium', 'high'];
    if (!obj.priority || !validPriorities.includes(String(obj.priority).toLowerCase())) {
      obj.priority = 'medium';
    } else {
      obj.priority = String(obj.priority).toLowerCase();
    }
    return obj;
  },
  RawTestCaseSchema
) as unknown as typeof RawTestCaseSchema;

const RawQualityRiskSchema = z.object({
  risk: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  mitigation: z.string(),
});

export const QualityRiskSchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    const validSeverities = ['low', 'medium', 'high'];
    if (!obj.severity || !validSeverities.includes(String(obj.severity).toLowerCase())) {
      obj.severity = 'medium';
    } else {
      obj.severity = String(obj.severity).toLowerCase();
    }
    return obj;
  },
  RawQualityRiskSchema
) as unknown as typeof RawQualityRiskSchema;

const RawQASchema = z.object({
  testStrategy: z.string(),
  testLevels: z.array(z.object({
    level: z.string(),
    description: z.string(),
    coverage: z.string(),
  })),
  testCases: z.array(TestCaseSchema),
  edgeCases: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  qualityRisks: z.array(QualityRiskSchema),
});

export const QASchema = z.preprocess(
  (raw: any) => {
    if (typeof raw !== 'object' || raw === null) return raw;
    const obj = { ...raw };
    if (!Array.isArray(obj.testLevels)) obj.testLevels = [];
    if (!Array.isArray(obj.testCases)) obj.testCases = [];
    if (!Array.isArray(obj.edgeCases)) obj.edgeCases = [];
    if (!Array.isArray(obj.acceptanceCriteria)) obj.acceptanceCriteria = [];
    if (!Array.isArray(obj.qualityRisks)) obj.qualityRisks = [];
    return obj;
  },
  RawQASchema
) as unknown as typeof RawQASchema;

export type QAOutput = z.infer<typeof RawQASchema>;
