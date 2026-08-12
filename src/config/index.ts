import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../logger.js';

dotenv.config();

const LLM_PROVIDERS = ['openrouter', 'openai', 'ollama', 'mock', 'bedrock'] as const;
const EMBEDDING_PROVIDERS = ['openai', 'openrouter', 'ollama', 'mock', 'bedrock'] as const;
const STORAGE_PROVIDERS = ['local', 's3'] as const;
const WEAK_JWT_SECRETS: string[] = ['dev-secret', 'secret', 'changeme'];

export const configSchema = z.object({
  // Server
  port: z.coerce.number().default(3001),
  logLevel: z.string().default('info'),
  nodeEnv: z.string().default('development'),
  gracePeriodMs: z.coerce.number().default(10000),
  trustProxy: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  // Filesystem access (path containment for review/index routes)
  allowedFsRoots: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  maxIndexFiles: z.coerce.number().default(500),

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

  // AWS Bedrock (optional)
  bedrockModel: z.string().default('anthropic.claude-3-5-sonnet-20240620-v1:0'),
  bedrockRegion: z.string().default('us-east-1'),
  bedrockTimeoutMs: z.coerce.number().default(60000),
  bedrockEmbeddingModel: z.string().default('amazon.titan-embed-text-v1'),
  bedrockEmbeddingDimensions: z.coerce.number().default(1536),

  // Artifact storage (local default, S3 optional)
  storageProvider: z.enum(STORAGE_PROVIDERS).default('local'),
  storageLocalDir: z.string().default('./data/storage'),
  s3Bucket: z.string().default(''),
  s3Region: z.string().default(''),
  s3Prefix: z.string().default('architectai'),
  s3ForcePathStyle: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),

  // CloudWatch observability (optional, off by default)
  cloudwatchEnabled: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
  cloudwatchRegion: z.string().default(''),
  cloudwatchNamespace: z.string().default('ArchitectAI'),
}).superRefine((val, ctx) => {
  if (val.storageProvider === 's3' && !val.s3Bucket) {
    ctx.addIssue({
      code: 'custom',
      path: ['s3Bucket'],
      message: 'S3_BUCKET is required when STORAGE_PROVIDER=s3',
    });
  }
  if (val.nodeEnv === 'production') {
    if (val.llmProvider === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['llmProvider'],
        message: 'LLM_PROVIDER=mock is not allowed in production',
      });
    }
    if (val.embeddingProvider === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['embeddingProvider'],
        message: 'EMBEDDING_PROVIDER=mock is not allowed in production',
      });
    }
    if (val.jwtSecret.length < 32 || WEAK_JWT_SECRETS.includes(val.jwtSecret)) {
      ctx.addIssue({
        code: 'custom',
        path: ['jwtSecret'],
        message: 'JWT_SECRET must be at least 32 characters and not a known default in production',
      });
    }
    if (!val.databaseUrl.includes('sslmode')) {
      logger.warn(
        { path: ['databaseUrl'] },
        'DATABASE_URL does not set sslmode — Amazon RDS requires SSL in production',
      );
    }
  }
  if (val.bedrockEmbeddingModel.includes('v2')) {
    const v2Dimensions = [256, 512, 1024];
    if (!v2Dimensions.includes(val.bedrockEmbeddingDimensions)) {
      ctx.addIssue({
        code: 'custom',
        path: ['bedrockEmbeddingDimensions'],
        message: 'BEDROCK_EMBEDDING_DIMENSIONS must be 256, 512, or 1024 when using a Titan v2 embedding model',
      });
    }
  }
});

export type Config = z.infer<typeof configSchema>;
export const storageProviderOptions = STORAGE_PROVIDERS;

function loadConfig(): Config {
  const raw = {
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    nodeEnv: process.env.NODE_ENV,
    gracePeriodMs: process.env.GRACE_PERIOD_MS,
    trustProxy: process.env.TRUST_PROXY,
    allowedFsRoots: process.env.ALLOWED_FS_ROOTS,
    maxIndexFiles: process.env.MAX_INDEX_FILES,
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
    bedrockModel: process.env.BEDROCK_MODEL,
    bedrockRegion: process.env.BEDROCK_REGION,
    bedrockTimeoutMs: process.env.BEDROCK_TIMEOUT_MS,
    bedrockEmbeddingModel: process.env.BEDROCK_EMBEDDING_MODEL,
    bedrockEmbeddingDimensions: process.env.BEDROCK_EMBEDDING_DIMENSIONS,
    storageProvider: process.env.STORAGE_PROVIDER,
    storageLocalDir: process.env.STORAGE_LOCAL_DIR,
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION,
    s3Prefix: process.env.S3_PREFIX,
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE,
    cloudwatchEnabled: process.env.CLOUDWATCH_ENABLED,
    cloudwatchRegion: process.env.CLOUDWATCH_REGION,
    cloudwatchNamespace: process.env.CLOUDWATCH_METRICS_NAMESPACE,
  };

  const result = configSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  return Object.freeze(result.data);
}

export const config = loadConfig();
