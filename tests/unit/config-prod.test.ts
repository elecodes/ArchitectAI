import { describe, it, expect, vi, afterEach } from 'vitest';
import { configSchema } from '../../src/config/index.js';
import { logger } from '../../src/logger.js';

const strong = {
  databaseUrl: 'postgres://localhost/test?sslmode=require',
  jwtSecret: 'prod-super-secret-jwt-signing-key-0123456789',
};

describe('config schema — production gate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects LLM_PROVIDER=mock in production', () => {
    const parsed = configSchema.safeParse({
      ...strong,
      nodeEnv: 'production',
      llmProvider: 'mock',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'llmProvider')).toBe(true);
    }
  });

  it('rejects EMBEDDING_PROVIDER=mock in production', () => {
    const parsed = configSchema.safeParse({
      ...strong,
      nodeEnv: 'production',
      embeddingProvider: 'mock',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'embeddingProvider')).toBe(true);
    }
  });

  it('rejects short JWT_SECRET in production', () => {
    const parsed = configSchema.safeParse({
      ...strong,
      nodeEnv: 'production',
      jwtSecret: 'short-secret',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'jwtSecret')).toBe(true);
    }
  });

  it('rejects known weak JWT_SECRET values in production', () => {
    for (const weak of ['dev-secret', 'secret', 'changeme']) {
      const parsed = configSchema.safeParse({
        ...strong,
        nodeEnv: 'production',
        jwtSecret: weak,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it('accepts a strong non-mock production config with sslmode', () => {
    const parsed = configSchema.safeParse({
      ...strong,
      nodeEnv: 'production',
      llmProvider: 'bedrock',
      embeddingProvider: 'bedrock',
    });
    expect(parsed.success).toBe(true);
  });

  it('warns but passes when DATABASE_URL lacks sslmode in production', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const parsed = configSchema.safeParse({
      ...strong,
      nodeEnv: 'production',
      databaseUrl: 'postgres://localhost/test',
      llmProvider: 'bedrock',
      embeddingProvider: 'bedrock',
    });
    expect(parsed.success).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('does not warn when sslmode is set', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const parsed = configSchema.safeParse({
      ...strong,
      nodeEnv: 'production',
      llmProvider: 'bedrock',
      embeddingProvider: 'bedrock',
    });
    expect(parsed.success).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('keeps dev behavior: mock providers and short secrets still pass outside production', () => {
    const parsed = configSchema.safeParse({
      databaseUrl: 'postgres://localhost/test',
      jwtSecret: 'dev-secret',
      nodeEnv: 'development',
      llmProvider: 'mock',
      embeddingProvider: 'mock',
    });
    expect(parsed.success).toBe(true);
  });
});
