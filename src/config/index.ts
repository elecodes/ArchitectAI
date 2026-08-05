import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const LLM_PROVIDERS = ['openrouter', 'openai', 'ollama', 'mock'] as const;
const EMBEDDING_PROVIDERS = ['openai', 'openrouter', 'ollama', 'mock'] as const;

const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3001),
  logLevel: z.string().default('info'),
  nodeEnv: z.string().default('development'),

  // Database
  databaseUrl: z.string().min(1, 'DATABASE_URL is required'),

  // Authentication
  jwtSecret: z.string().min(1, 'JWT_SECRET is required').refine(
    (val) => val !== 'dev-secret-change-in-prod' && val !== 'changeme',
    'JWT_SECRET must not be a placeholder value'
  ),

  // LLM Provider
  llmProvider: z.enum(LLM_PROVIDERS).default('openrouter'),
  llmApiKey: z.string().default(''),
  llmModel: z.string().default('anthropic/claude-3.5-sonnet'),
  llmContextWindow: z.coerce.number().default(128000),

  // Embedding Provider
  embeddingProvider: z.enum(EMBEDDING_PROVIDERS).default('openai'),
  embeddingApiKey: z.string().default(''),
  embeddingModel: z.string().default('text-embedding-3-small'),
  embeddingDimensions: z.coerce.number().default(1536),

  // Ollama (optional)
  ollamaUrl: z.string().default('http://localhost:11434'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const raw = {
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    llmProvider: process.env.LLM_PROVIDER,
    llmApiKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL,
    llmContextWindow: process.env.LLM_CONTEXT_WINDOW,
    embeddingProvider: process.env.EMBEDDING_PROVIDER,
    embeddingApiKey: process.env.EMBEDDING_API_KEY,
    embeddingModel: process.env.EMBEDDING_MODEL,
    embeddingDimensions: process.env.EMBEDDING_DIMENSIONS,
    ollamaUrl: process.env.OLLAMA_URL,
  };

  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return Object.freeze(result.data);
}

export const config = loadConfig();
