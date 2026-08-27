import { z } from 'zod';

export const IntakeQuestionSchema = z.object({
  id: z.string().describe('Unique identifier for the intake question (e.g., db_type, scale)'),
  category: z.enum(['stack', 'scale', 'compliance', 'budget', 'latency', 'domain']).describe('Architectural category'),
  question: z.string().describe('The probing question to ask the user'),
  options: z.array(z.string()).describe('List of 2 to 4 recommended choices'),
  recommendation: z.string().describe('Default recommendation if skipped'),
  rationale: z.string().describe('Architectural rationale for why this question matters'),
});

export const IntakeOutputSchema = z.object({
  isSufficient: z.boolean().describe('True if the initial user prompt is detailed enough and needs no further questions'),
  summary: z.string().describe('Brief assessment of the input prompt clarity'),
  questions: z.array(IntakeQuestionSchema).max(5).describe('List of up to 5 intake questions'),
});

export const UserIntakeResponseSchema = z.object({
  answers: z.record(z.string(), z.string()).describe('Map of question ID to user selected answer or custom input'),
  skipped: z.boolean().default(false).describe('Whether the user chose to skip and use recommendations'),
});

export type IntakeQuestion = z.infer<typeof IntakeQuestionSchema>;
export type IntakeOutput = z.infer<typeof IntakeOutputSchema>;
export type UserIntakeResponse = z.infer<typeof UserIntakeResponseSchema>;
