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
    let cleanText = raw.trim();

    // Step 1: Extract JSON from markdown code blocks
    const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      cleanText = codeBlockMatch[1].trim();
    } else {
      // Step 1b: Extract outermost JSON object if leading/trailing prose exists
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleanText = cleanText.slice(firstBrace, lastBrace + 1).trim();
      }
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
