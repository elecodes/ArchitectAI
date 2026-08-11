import rateLimit from 'express-rate-limit';

// General API rate limit: 100 requests per minute
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
});

// Generation endpoints: 10 requests per minute (expensive LLM calls)
export const generationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GENERATION || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Generation rate limit exceeded. Please wait before generating again.' } },
});

// Export endpoints: 10 requests per minute (storage writes + package assembly)
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_EXPORT || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Export rate limit exceeded. Please wait before exporting again.' } },
});

// Index endpoints: 5 requests per minute (unbounded embedding cost per call)
export const indexLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_INDEX || '5', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Index rate limit exceeded. Please wait before indexing again.' } },
});
