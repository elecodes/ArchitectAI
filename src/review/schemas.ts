import { z } from 'zod';

export const FolderResponsibilitySchema = z.object({
  folder: z.string(),
  responsibility: z.string(),
});

export const ProjectSummarySchema = z.object({
  projectSummary: z.string().min(1),
  architectureOverview: z.string().min(1),
  folderResponsibilities: z.array(FolderResponsibilitySchema).min(1),
  detectedPatterns: z.array(z.string()),
  potentialProblems: z.array(z.string()),
  technicalDebt: z.array(z.string()),
  entryPoints: z.array(z.string()),
  criticalComponents: z.array(z.string()),
});

export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;

export const QualityDimensionSchema = z.object({
  score: z.number().min(1).max(10),
  observations: z.array(z.string()).optional(),
  violations: z.array(z.string()).optional(),
  summary: z.string().optional(),
});

export const EngineeringReviewSchema = z.object({
  codeQuality: QualityDimensionSchema,
  architectureQuality: QualityDimensionSchema,
  solidAdherence: QualityDimensionSchema,
  cleanArchitecture: QualityDimensionSchema,
  security: QualityDimensionSchema,
  maintainability: QualityDimensionSchema,
  scalability: QualityDimensionSchema,
  readability: QualityDimensionSchema,
  documentation: QualityDimensionSchema,
  testQuality: QualityDimensionSchema,
  overallMaturity: QualityDimensionSchema,
});

export type EngineeringReview = z.infer<typeof EngineeringReviewSchema>;

export const RecommendationSchema = z.object({
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  problem: z.string().min(1),
  reason: z.string().min(1),
  suggestion: z.string().min(1),
  effort: z.enum(['small', 'medium', 'large']),
});

export const ImprovementsSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1).max(15),
});

export type Improvements = z.infer<typeof ImprovementsSchema>;
