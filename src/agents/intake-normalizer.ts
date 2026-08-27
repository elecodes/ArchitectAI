import type { IntakeQuestion } from './schemas/intake.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('intake-normalizer');

const PHRASE_MAPPINGS: Record<string, Record<string, string>> = {
  budget: {
    cheap: 'Free Tier / Low Cost (<$50/mo)',
    low: 'Free Tier / Low Cost (<$50/mo)',
    minimal: 'Free Tier / Low Cost (<$50/mo)',
    economy: 'Free Tier / Low Cost (<$50/mo)',
  },
  scale: {
    cheap: '<10k concurrent users',
    small: '<10k concurrent users',
    massive: '>1M concurrent users',
    huge: '100k-1M concurrent users',
    large: '100k-1M concurrent users',
    medium: '10k-100k concurrent users',
  },
  latency: {
    fast: '<100ms real-time delivery',
    quick: '<100ms real-time delivery',
    instant: '<100ms real-time delivery',
    normal: '100ms-300ms',
  },
  stack: {
    simple: 'Node.js (Express) + React Monolith',
    basic: 'Node.js (Express) + React Monolith',
    standard: 'Node.js (Express) + PostgreSQL',
    fast: 'Node.js + WebSockets',
  },
};

export function normalizeUserIntakeResponse(
  userAnswers: Record<string, string>,
  questions: IntakeQuestion[] = [],
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const q of questions) {
    const rawAnswer = userAnswers[q.id]?.trim();

    if (!rawAnswer) {
      log.info({ questionId: q.id, defaultUsed: q.recommendation }, 'Blank answer, using recommendation default');
      normalized[q.id] = q.recommendation;
      continue;
    }

    // Check if raw answer directly matches one of the predefined options
    const exactMatch = q.options.find((opt) => opt.toLowerCase() === rawAnswer.toLowerCase());
    if (exactMatch) {
      normalized[q.id] = exactMatch;
      continue;
    }

    // Attempt semantic phrase mapping
    const categoryMappings = PHRASE_MAPPINGS[q.category];
    let matchedSemantic = false;

    if (categoryMappings) {
      const lowerRaw = rawAnswer.toLowerCase();
      for (const [keyword, mappedValue] of Object.entries(categoryMappings)) {
        if (lowerRaw.includes(keyword)) {
          log.info({ questionId: q.id, rawAnswer, keyword, mappedValue }, 'Normalized fuzzy write-in via semantic phrase mapping');
          normalized[q.id] = mappedValue;
          matchedSemantic = true;
          break;
        }
      }
    }

    if (!matchedSemantic) {
      // If write-in answer has substance (>= 3 chars), preserve write-in text with clean framing
      if (rawAnswer.length >= 3) {
        log.info({ questionId: q.id, rawAnswer }, 'Preserving custom write-in answer');
        normalized[q.id] = rawAnswer;
      } else {
        log.info({ questionId: q.id, rawAnswer, fallback: q.recommendation }, 'Fuzzy answer too short, falling back to recommendation');
        normalized[q.id] = q.recommendation;
      }
    }
  }

  // Also include any custom keys provided by user that weren't in questions list
  for (const [key, value] of Object.entries(userAnswers)) {
    if (!normalized[key] && value) {
      normalized[key] = value.trim();
    }
  }

  return normalized;
}
