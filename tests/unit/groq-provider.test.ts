import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIClient } from '../../src/llm/providers/openai.js';

// ── Global fetch mock ────────────────────────────────────────────────
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────

function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorStatus(status: number, body = '{}'): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function networkError(): never {
  throw new TypeError('Failed to fetch');
}

/** Minimal valid OpenAI-compatible chat completion payload. */
function chatPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'chatcmpl-groq123',
    object: 'chat.completion',
    created: 1_700_000_000,
    model: 'openai/gpt-oss-120b',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'hello from groq' },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Groq provider (OpenAIClient with Groq baseUrl)', () => {
  const GROQ_BASE = 'https://api.groq.com/openai/v1';
  const GROQ_KEY = 'gsk_test_key_abc';

  function groqClient() {
    return new OpenAIClient({
      apiKey: GROQ_KEY,
      model: 'openai/gpt-oss-120b',
      baseUrl: GROQ_BASE,
    });
  }

  // ── complete() ──────────────────────────────────────────────────

  describe('complete()', () => {
    it('sends correct request to Groq API', async () => {
      fetchMock.mockResolvedValueOnce(okJson(chatPayload()));

      const client = groqClient();
      await client.complete({ prompt: 'hi', systemPrompt: 'sys' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;

      // URL
      expect(url).toBe(`${GROQ_BASE}/chat/completions`);

      // Headers
      expect(init!.headers).toMatchObject({
        Authorization: `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      });

      // Body
      const body = JSON.parse(init!.body as string);
      expect(body.model).toBe('openai/gpt-oss-120b');
      expect(body.messages).toEqual([
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hi' },
      ]);
      expect(body.temperature).toBe(0.3);
      expect(body.max_tokens).toBe(4096);
    });

    it('handles successful response', async () => {
      fetchMock.mockResolvedValueOnce(okJson(chatPayload()));

      const client = groqClient();
      const res = await client.complete({ prompt: 'hi', systemPrompt: 'sys' });

      expect(res.content).toBe('hello from groq');
      expect(res.tokenCount).toEqual({ prompt: 10, completion: 5 });
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles 4xx API errors', async () => {
      fetchMock.mockResolvedValueOnce(errorStatus(401, JSON.stringify({ error: { message: 'Invalid API key' } })));

      const client = groqClient();
      await expect(
        client.complete({ prompt: 'hi', systemPrompt: 'sys' }),
      ).rejects.toThrow('OpenAI authentication failed');
    });

    it('handles 5xx API errors', async () => {
      fetchMock.mockResolvedValueOnce(errorStatus(503, JSON.stringify({ error: { message: 'Service unavailable' } })));

      const client = groqClient();
      await expect(
        client.complete({ prompt: 'hi', systemPrompt: 'sys' }),
      ).rejects.toThrow('OpenAI API error (503)');
    });

    it('handles rate-limit (429) errors', async () => {
      fetchMock.mockResolvedValueOnce(errorStatus(429));

      const client = groqClient();
      await expect(
        client.complete({ prompt: 'hi', systemPrompt: 'sys' }),
      ).rejects.toThrow('OpenAI rate limited');
    });

    it('handles network errors', async () => {
      fetchMock.mockImplementationOnce(networkError);

      const client = groqClient();
      await expect(
        client.complete({ prompt: 'hi', systemPrompt: 'sys' }),
      ).rejects.toThrow();
    });

    it('falls back to heuristic token counts when usage is missing', async () => {
      fetchMock.mockResolvedValueOnce(
        okJson(chatPayload({ usage: undefined })),
      );

      const client = groqClient();
      const res = await client.complete({ prompt: 'four', systemPrompt: 's' });

      // Heuristic: prompt tokens = ceil(length / 4), completion tokens = ceil('hello from groq'.length / 4)
      expect(res.tokenCount.prompt).toBe(Math.ceil('four'.length / 4));
      expect(res.tokenCount.completion).toBe(Math.ceil('hello from groq'.length / 4));
    });

    it('uses custom temperature and maxTokens when provided', async () => {
      fetchMock.mockResolvedValueOnce(okJson(chatPayload()));

      const client = groqClient();
      await client.complete({ prompt: 'hi', systemPrompt: 's', temperature: 0.8, maxTokens: 1024 });

      const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
      expect(body.temperature).toBe(0.8);
      expect(body.max_tokens).toBe(1024);
    });
  });

  // ── embed() ─────────────────────────────────────────────────────

  describe('embed()', () => {
    it('throws error (Groq has no embedding API)', async () => {
      // Groq API returns 404/400 for /embeddings — OpenAIClient throws on non-OK
      fetchMock.mockResolvedValueOnce(
        errorStatus(404, JSON.stringify({ error: { message: 'Not found' } })),
      );

      const client = groqClient();
      await expect(client.embed('text')).rejects.toThrow('OpenAI embedding error (404)');
    });
  });

  // ── isHealthy() ─────────────────────────────────────────────────

  describe('isHealthy()', () => {
    it('returns true when API is reachable', async () => {
      fetchMock.mockResolvedValueOnce(okJson({ data: [] }));

      const client = groqClient();
      await expect(client.isHealthy()).resolves.toBe(true);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${GROQ_BASE}/models`);
      expect(init!.headers).toMatchObject({
        Authorization: `Bearer ${GROQ_KEY}`,
      });
    });

    it('returns false when API is unreachable', async () => {
      fetchMock.mockImplementationOnce(networkError);

      const client = groqClient();
      await expect(client.isHealthy()).resolves.toBe(false);
    });

    it('returns false on non-OK status', async () => {
      fetchMock.mockResolvedValueOnce(errorStatus(500));

      const client = groqClient();
      await expect(client.isHealthy()).resolves.toBe(false);
    });
  });
});

// ── Factory integration tests ────────────────────────────────────────
// Config type-only import does NOT trigger loadConfig(), so no env vars needed.

import type { Config } from '../../src/config/index.js';
import { createLLMClient, createEmbeddingClient } from '../../src/llm/factory.js';

function cfg(overrides: Partial<Config> = {}): Config {
  return {
    port: 3001,
    logLevel: 'info',
    nodeEnv: 'test',
    gracePeriodMs: 10000,
    trustProxy: false as unknown as Config['trustProxy'],
    allowedFsRoots: [],
    maxIndexFiles: 500,
    databaseUrl: 'postgres://localhost/test',
    jwtSecret: 'test-secret-not-placeholder',
    llmProvider: 'mock',
    llmApiKey: '',
    llmModel: 'm',
    llmContextWindow: 128000,
    embeddingProvider: 'mock',
    embeddingApiKey: '',
    embeddingModel: 'e',
    embeddingDimensions: 1536,
    ollamaUrl: 'http://localhost:11434',
    bedrockModel: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    bedrockRegion: 'us-east-1',
    bedrockTimeoutMs: 60000,
    bedrockEmbeddingModel: 'amazon.titan-embed-text-v1',
    bedrockEmbeddingDimensions: 1536,
    groqApiKey: '',
    groqModel: 'openai/gpt-oss-120b',
    googleApiKey: '',
    googleModel: 'gemini-2.0-flash',
    googleEmbeddingModel: 'text-embedding-004',
    storageProvider: 'local',
    storageLocalDir: './data/storage',
    s3Bucket: '',
    s3Region: '',
    s3Prefix: 'architectai',
    s3ForcePathStyle: false as unknown as Config['s3ForcePathStyle'],
    cloudwatchEnabled: false,
    cloudwatchRegion: '',
    cloudwatchNamespace: 'ArchitectAI',
    ...overrides,
  } as Config;
}

describe('Factory integration for groq provider', () => {
  it('createLLMClient with provider=groq creates OpenAIClient', () => {
    const client = createLLMClient(cfg({ llmProvider: 'groq', groqApiKey: 'gsk_key' }));
    expect(client).toBeInstanceOf(OpenAIClient);
  });

  it('createLLMClient with provider=groq throws when GROQ_API_KEY is missing', () => {
    expect(() => createLLMClient(cfg({ llmProvider: 'groq', groqApiKey: '' }))).toThrow(
      'GROQ_API_KEY is required',
    );
  });

  it('createEmbeddingClient with provider=groq throws (not supported)', () => {
    expect(() =>
      createEmbeddingClient(cfg({ embeddingProvider: 'groq' as Config['embeddingProvider'] })),
    ).toThrow(/Unknown embedding provider/i);
  });
});
