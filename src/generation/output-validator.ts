import { z } from 'zod';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('output-validator');

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    raw: string;
    parseError?: string;
    zodError?: string;
  };
}

export class OutputValidator {
  validate<T>(raw: string, schema: z.ZodType<T>): ValidationResult<T> {
    // Step 1: Extract JSON from markdown code blocks if present
    let cleanText = raw.trim();
    const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      cleanText = jsonMatch[1].trim();
    }

    // Step 2: JSON parse
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanText);
    } catch (e) {
      log.debug({ rawLength: raw.length, parseError: (e as Error).message }, 'JSON parse failed');
      return { success: false, error: { raw, parseError: (e as Error).message } };
    }

    // Step 3: Schema validation
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const zodError = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      log.debug({ zodError }, 'Schema validation failed');
      return { success: false, error: { raw, zodError } };
    }

    return { success: true, data: result.data };
  }
}
