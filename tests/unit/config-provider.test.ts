import { describe, it, expect } from 'vitest';
import { configSchema } from '../../src/config/index.js';

const base = {
  databaseUrl: 'postgres://localhost/test',
  jwtSecret: 'test-secret-not-placeholder',
};

describe('config schema — provider validation & defaults', () => {
  // ── Mock provider ─────────────────────────────────────────────

  it('allows mock provider without API key', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'mock',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('mock');
      expect(parsed.data.llmApiKey).toBe('');
    }
  });

  // ── Groq provider ─────────────────────────────────────────────

  it('requires GROQ_API_KEY when provider is groq', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'groq',
      groqApiKey: '',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'groqApiKey')).toBe(true);
    }
  });

  it('accepts groq provider when API key is provided', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'groq',
      groqApiKey: 'gsk_test_key',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('groq');
      expect(parsed.data.groqApiKey).toBe('gsk_test_key');
    }
  });

  // ── Google provider ───────────────────────────────────────────

  it('requires GOOGLE_API_KEY when provider is google', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'google',
      googleApiKey: '',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'googleApiKey')).toBe(true);
    }
  });

  it('accepts google provider when API key is provided', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'google',
      googleApiKey: 'ai_test_key',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('google');
      expect(parsed.data.googleApiKey).toBe('ai_test_key');
    }
  });

  // ── Default models ────────────────────────────────────────────

  it('defaults groqModel to openai/gpt-oss-120b', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'groq',
      groqApiKey: 'key',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.groqModel).toBe('openai/gpt-oss-120b');
    }
  });

  it('defaults googleModel to gemini-2.0-flash', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'google',
      googleApiKey: 'key',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.googleModel).toBe('gemini-2.0-flash');
    }
  });

  it('defaults googleEmbeddingModel to text-embedding-004', () => {
    const parsed = configSchema.safeParse({
      ...base,
      embeddingProvider: 'google',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.googleEmbeddingModel).toBe('text-embedding-004');
    }
  });

  // ── Custom model overrides ────────────────────────────────────

  it('allows custom groqModel override', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'groq',
      groqApiKey: 'key',
      groqModel: 'custom/model',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.groqModel).toBe('custom/model');
    }
  });

  it('allows custom googleModel override', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'google',
      googleApiKey: 'key',
      googleModel: 'gemini-2.5-pro',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.googleModel).toBe('gemini-2.5-pro');
    }
  });

  it('allows custom googleEmbeddingModel override', () => {
    const parsed = configSchema.safeParse({
      ...base,
      embeddingProvider: 'google',
      googleEmbeddingModel: 'text-embedding-005',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.googleEmbeddingModel).toBe('text-embedding-005');
    }
  });

  // ── Invalid provider ──────────────────────────────────────────

  it('rejects invalid LLM provider name', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'invalid-provider',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid embedding provider name', () => {
    const parsed = configSchema.safeParse({
      ...base,
      embeddingProvider: 'invalid-provider',
    });
    expect(parsed.success).toBe(false);
  });

  // ── LLM_PROVIDER env var parsing ──────────────────────────────

  it('parses LLM_PROVIDER=groq correctly', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'groq',
      groqApiKey: 'gsk_key',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('groq');
      expect(parsed.data.groqApiKey).toBe('gsk_key');
    }
  });

  it('parses LLM_PROVIDER=google correctly', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'google',
      googleApiKey: 'ai_key',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('google');
      expect(parsed.data.googleApiKey).toBe('ai_key');
    }
  });

  it('parses LLM_PROVIDER=mock correctly', () => {
    const parsed = configSchema.safeParse({
      ...base,
      llmProvider: 'mock',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('mock');
    }
  });

  it('defaults LLM_PROVIDER to openrouter when unset', () => {
    const parsed = configSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.llmProvider).toBe('openrouter');
    }
  });
});
