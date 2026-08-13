import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { GoogleClient } from '../../src/llm/providers/google.js';
import { createLLMClient, createEmbeddingClient } from '../../src/llm/factory.js';
import type { Config } from '../../src/config/index.js';

function okJson(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errJson(status: number, message = 'error') {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GoogleClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete()', () => {
    it('sends correct request to Google API', async () => {
      fetchMock.mockResolvedValue(
        okJson({
          candidates: [{ content: { parts: [{ text: 'hello from gemini' }] } }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 },
        }),
      );

      const client = new GoogleClient({ apiKey: 'test-key', model: 'gemini-2.0-flash' });
      await client.complete({ prompt: 'hi', systemPrompt: 'sys' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=test-key',
      );
      expect(opts.method).toBe('POST');

      const body = JSON.parse(opts.body);
      expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
      expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
      expect(body.generationConfig.temperature).toBe(0.3);
      expect(body.generationConfig.maxOutputTokens).toBe(4096);
    });

    it('handles successful response', async () => {
      fetchMock.mockResolvedValue(
        okJson({
          candidates: [{ content: { parts: [{ text: 'response text' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 8 },
        }),
      );

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      const res = await client.complete({ prompt: 'test', systemPrompt: 's' });

      expect(res.content).toBe('response text');
      expect(res.tokenCount).toEqual({ prompt: 10, completion: 8 });
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('falls back to heuristic token counts when usage is missing', async () => {
      fetchMock.mockResolvedValue(
        okJson({
          candidates: [{ content: { parts: [{ text: 'abc' }] } }],
        }),
      );

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      const res = await client.complete({ prompt: 'four', systemPrompt: 's' });

      expect(res.tokenCount.prompt).toBe(Math.ceil('four'.length / 4));
      expect(res.tokenCount.completion).toBe(Math.ceil(3 / 4));
    });

    it('handles API errors (4xx)', async () => {
      fetchMock.mockResolvedValue(errJson(403, 'forbidden'));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.complete({ prompt: 'hi', systemPrompt: 's' })).rejects.toThrow(
        'authentication failed',
      );
    });

    it('handles rate limiting (429)', async () => {
      fetchMock.mockResolvedValue(errJson(429, 'rate limited'));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.complete({ prompt: 'hi', systemPrompt: 's' })).rejects.toThrow(
        'rate limited',
      );
    });

    it('handles server errors (5xx)', async () => {
      fetchMock.mockResolvedValue(errJson(500, 'internal'));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.complete({ prompt: 'hi', systemPrompt: 's' })).rejects.toThrow(
        'API error (500)',
      );
    });

    it('handles network errors', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.complete({ prompt: 'hi', systemPrompt: 's' })).rejects.toThrow(
        'fetch failed',
      );
    });

    it('does not send systemInstruction when systemPrompt is empty', async () => {
      fetchMock.mockResolvedValue(
        okJson({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
      );

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await client.complete({ prompt: 'hi', systemPrompt: '' });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.systemInstruction).toBeUndefined();
    });

    it('respects custom temperature and maxTokens', async () => {
      fetchMock.mockResolvedValue(
        okJson({
          candidates: [{ content: { parts: [{ text: 'ok' }] } }],
        }),
      );

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await client.complete({ prompt: 'hi', systemPrompt: 's', temperature: 0.9, maxTokens: 2048 });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.generationConfig.temperature).toBe(0.9);
      expect(body.generationConfig.maxOutputTokens).toBe(2048);
    });
  });

  describe('embed()', () => {
    it('sends correct request to embedContent endpoint', async () => {
      fetchMock.mockResolvedValue(
        okJson({ embedding: { values: [0.1, 0.2, 0.3] } }),
      );

      const client = new GoogleClient({
        apiKey: 'test-key',
        model: 'm',
        embeddingModel: 'text-embedding-004',
      });
      await client.embed('text');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=test-key',
      );
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ content: { parts: [{ text: 'text' }] } });
    });

    it('handles successful response', async () => {
      fetchMock.mockResolvedValue(
        okJson({ embedding: { values: [0.1, 0.2, 0.3] } }),
      );

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      const res = await client.embed('hello');

      expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles API errors', async () => {
      fetchMock.mockResolvedValue(errJson(400, 'bad request'));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.embed('text')).rejects.toThrow('embedding error (400)');
    });

    it('throws when embedding response is missing vector', async () => {
      fetchMock.mockResolvedValue(okJson({}));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.embed('text')).rejects.toThrow('missing the embedding vector');
    });

    it('uses default embedding model when none configured', async () => {
      fetchMock.mockResolvedValue(
        okJson({ embedding: { values: [0.5] } }),
      );

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await client.embed('text');

      const url = fetchMock.mock.calls[0][0];
      expect(url).toContain('models/text-embedding-004:embedContent');
    });
  });

  describe('isHealthy()', () => {
    it('returns true when API is reachable', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.isHealthy()).resolves.toBe(true);

      const url = fetchMock.mock.calls[0][0];
      expect(url).toBe(
        'https://generativelanguage.googleapis.com/v1beta/models/m?key=k',
      );
      expect(fetchMock.mock.calls[0][1].method).toBeUndefined(); // default GET
    });

    it('returns false when API is unreachable', async () => {
      fetchMock.mockRejectedValue(new TypeError('network error'));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.isHealthy()).resolves.toBe(false);
    });

    it('returns false when API returns non-ok status', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.isHealthy()).resolves.toBe(false);
    });
  });
});

describe('Factory integration', () => {
  const baseConfig: Config = {
    port: 3001,
    logLevel: 'info',
    nodeEnv: 'test',
    gracePeriodMs: 10000,
    trustProxy: false,
    allowedFsRoots: [],
    maxIndexFiles: 500,
    databaseUrl: 'postgres://test',
    jwtSecret: 'test-secret',
    llmProvider: 'google',
    llmApiKey: '',
    llmModel: 'gemini-2.0-flash',
    llmContextWindow: 128000,
    embeddingProvider: 'google',
    embeddingApiKey: '',
    embeddingModel: 'text-embedding-004',
    embeddingDimensions: 1536,
    ollamaUrl: 'http://localhost:11434',
    bedrockModel: '',
    bedrockRegion: 'us-east-1',
    bedrockTimeoutMs: 60000,
    bedrockEmbeddingModel: '',
    bedrockEmbeddingDimensions: 1536,
    groqApiKey: '',
    groqModel: '',
    googleApiKey: 'test-api-key',
    googleModel: 'gemini-2.0-flash',
    googleEmbeddingModel: 'text-embedding-004',
    storageProvider: 'local',
    storageLocalDir: './data/storage',
    s3Bucket: '',
    s3Region: '',
    s3Prefix: '',
    s3ForcePathStyle: false,
    jwtExpiresIn: '1h',
    corsOrigin: '*',
    maxUploadSize: 10,
    reviewMaxFiles: 500,
    reviewTimeoutMs: 30000,
  } as Config;

  it('createLLMClient with provider=google creates GoogleClient', () => {
    const client = createLLMClient({ ...baseConfig, llmProvider: 'google' });
    expect(client).toBeInstanceOf(GoogleClient);
  });

  it('createEmbeddingClient with provider=google creates GoogleClient', () => {
    const client = createEmbeddingClient({ ...baseConfig, embeddingProvider: 'google' });
    expect(client).toBeInstanceOf(GoogleClient);
  });

  it('createLLMClient throws when googleApiKey is missing', () => {
    expect(() =>
      createLLMClient({ ...baseConfig, llmProvider: 'google', googleApiKey: '' }),
    ).toThrow('GOOGLE_API_KEY is required');
  });

  it('createEmbeddingClient throws when googleApiKey is missing', () => {
    expect(() =>
      createEmbeddingClient({ ...baseConfig, embeddingProvider: 'google', googleApiKey: '' }),
    ).toThrow('GOOGLE_API_KEY is required');
  });
});
