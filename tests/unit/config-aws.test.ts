import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/index.js';

const base = { databaseUrl: 'postgres://localhost/test', jwtSecret: 'test-secret-not-placeholder' };

describe('config schema — AWS additions', () => {
  it('accepts bedrock as a valid LLM provider', () => {
    const parsed = configSchema.safeParse({ ...base, llmProvider: 'bedrock' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.llmProvider).toBe('bedrock');
  });

  it('rejects unknown LLM providers', () => {
    const parsed = configSchema.safeParse({ ...base, llmProvider: 'foo' });
    expect(parsed.success).toBe(false);
  });

  it('defaults storageProvider to local and cloudwatch to false', () => {
    const parsed = configSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.storageProvider).toBe('local');
      expect(parsed.data.cloudwatchEnabled).toBe(false);
      expect(parsed.data.s3Bucket).toBe('');
    }
  });

  it('requires S3_BUCKET when storage provider is s3', () => {
    const parsed = configSchema.safeParse({ ...base, storageProvider: 's3', s3Bucket: '' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 's3Bucket')).toBe(true);
    }
  });

  it('accepts s3 when a bucket is provided', () => {
    const parsed = configSchema.safeParse({
      ...base,
      storageProvider: 's3',
      s3Bucket: 'my-bucket',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.s3Bucket).toBe('my-bucket');
  });

  it('parses CLOUDWATCH_ENABLED=true from an env string', () => {
    const parsed = configSchema.safeParse({ ...base, cloudwatchEnabled: 'true' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.cloudwatchEnabled).toBe(true);
  });

  it('parses CLOUDWATCH_ENABLED=false as false (not truthy)', () => {
    const parsed = configSchema.safeParse({ ...base, cloudwatchEnabled: 'false' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.cloudwatchEnabled).toBe(false);
  });

  it('exposes Bedrock defaults', () => {
    const parsed = configSchema.safeParse(base);
    if (parsed.success) {
      expect(parsed.data.bedrockModel).toBe('anthropic.claude-3-5-sonnet-20240620-v1:0');
      expect(parsed.data.bedrockRegion).toBe('us-east-1');
      expect(parsed.data.bedrockEmbeddingModel).toBe('amazon.titan-embed-text-v2');
    }
  });
});
