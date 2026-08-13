# Design: Multi-Provider LLM Expansion

## Overview

Extend ArchitectAI with Groq (OpenAI-compatible) and Google Gemini (native REST) LLM providers, plus Google Embedding 001 support. Zero breaking changes — all 241+ tests pass.

## 1. File-by-File Change List

### NEW Files

| File | Purpose |
|------|---------|
| `src/llm/providers/groq.ts` | Groq provider (re-exports OpenAIClient with preset) |
| `src/llm/providers/google.ts` | Google Gemini native REST client |
| `tests/unit/groq-provider.test.ts` | Groq provider tests |
| `tests/unit/google-provider.test.ts` | Google Gemini provider tests |

### MODIFIED Files

| File | Changes |
|------|---------|
| `src/config/index.ts` | Add `groq`, `google` to provider arrays; add Groq/Google env vars; add `enableSearchGrounding`; provider-specific model defaults via superRefine |
| `src/llm/factory.ts` | Add `groq` and `google` cases to `createLLMClient` and `createEmbeddingClient` |
| `src/llm/providers/index.ts` | Export `GroqClient` and `GoogleClient` types |

### UNTOUCHED Files

| File | Reason |
|------|--------|
| `src/llm/providers/bedrock.ts` | No changes needed — Bedrock is independent |
| `src/llm/providers/openai.ts` | Groq reuses it as-is via `baseUrl` override |
| `src/llm/interface.ts` | `LLMClient` interface is sufficient for all providers |

---

## 2. GeminiClient Interface Design

### Request/Response Shapes (Gemini REST API)

```typescript
// --- Completion ---

interface GeminiGenerateContentRequest {
  contents: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: 'text/plain' | 'application/json';
    responseSchema?: Record<string, unknown>;
  };
  // safetySettings omitted — defaults are fine for our use case
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text: string }>;
      role?: string;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

// --- Embedding ---

interface GeminiEmbedContentRequest {
  model: string;  // path segment, e.g. "text-embedding-004"
  content: {
    parts: Array<{ text: string }>;
  };
  taskType?: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT';
  outputDimensionality?: number;
}

interface GeminiEmbedContentResponse {
  embedding?: {
    values?: number[];
  };
}
```

### GoogleClient Class Shape

```typescript
export interface GoogleConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  timeout?: number;
  enableSearchGrounding?: boolean;  // default: false
}

export class GoogleClient implements LLMClient {
  constructor(config: GoogleConfig);

  async complete(request: CompletionRequest): Promise<CompletionResponse>;
  async embed(text: string): Promise<EmbeddingResponse>;
  async isHealthy(): Promise<boolean>;
}
```

### Gemini API Call Pattern

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}
Content-Type: application/json

{
  "contents": [...],
  "systemInstruction": { "parts": [{ "text": "..." }] },
  "generationConfig": { "temperature": 0.3, "maxOutputTokens": 4096 }
}
```

- API key goes in query parameter (`?key=`), NOT in `Authorization` header
- System prompt goes in `systemInstruction`, not as a message role
- Error responses: `{ error: { code: number, message: string, status: string } }`
- Rate limit: HTTP 429 with `Retry-After` header

---

## 3. Config Schema Changes

### Provider Arrays

```typescript
// BEFORE
const LLM_PROVIDERS = ['openrouter', 'openai', 'ollama', 'mock', 'bedrock'] as const;
const EMBEDDING_PROVIDERS = ['openai', 'openrouter', 'ollama', 'mock', 'bedrock'] as const;

// AFTER
const LLM_PROVIDERS = ['openrouter', 'openai', 'ollama', 'mock', 'bedrock', 'groq', 'google'] as const;
const EMBEDDING_PROVIDERS = ['openai', 'openrouter', 'ollama', 'mock', 'bedrock', 'google'] as const;
```

### New Schema Fields

```typescript
// Groq (optional)
groqApiKey: z.string().default(''),
groqModel: z.string().default('llama-3.3-70b-versatile'),

// Google Gemini (optional)
googleApiKey: z.string().default(''),
googleModel: z.string().default('gemini-2.0-flash'),
googleEmbeddingModel: z.string().default('text-embedding-004'),
googleEmbeddingDimensions: z.coerce.number().default(768),

// Cost safety
enableSearchGrounding: z
  .enum(['true', 'false'])
  .optional()
  .default('false')
  .transform((v) => v === 'true'),
```

### Env Var Mappings (loadConfig)

```typescript
groqApiKey: process.env.GROQ_API_KEY,
groqModel: process.env.GROQ_MODEL,
googleApiKey: process.env.GOOGLE_API_KEY,
googleModel: process.env.GOOGLE_MODEL,
googleEmbeddingModel: process.env.GOOGLE_EMBEDDING_MODEL,
googleEmbeddingDimensions: process.env.GOOGLE_EMBEDDING_DIMENSIONS,
enableSearchGrounding: process.env.ENABLE_SEARCH_GROUNDING,
```

### Provider-Specific API Key Validation (superRefine)

Add AFTER the existing `bedrockEmbeddingModel` check:

```typescript
// Groq API key required when using Groq
if (val.llmProvider === 'groq' && !val.groqApiKey) {
  ctx.addIssue({
    code: 'custom',
    path: ['groqApiKey'],
    message: 'GROQ_API_KEY is required when LLM_PROVIDER=groq',
  });
}

// Google API key required when using Google
if (val.llmProvider === 'google' && !val.googleApiKey) {
  ctx.addIssue({
    code: 'custom',
    path: ['googleApiKey'],
    message: 'GOOGLE_API_KEY is required when LLM_PROVIDER=google',
  });
}

// Google embedding API key required
if (val.embeddingProvider === 'google' && !val.googleApiKey) {
  ctx.addIssue({
    code: 'custom',
    path: ['googleApiKey'],
    message: 'GOOGLE_API_KEY is required when EMBEDDING_PROVIDER=google',
  });
}

// Groq does not support embeddings
if (val.embeddingProvider === 'groq') {
  ctx.addIssue({
    code: 'custom',
    path: ['embeddingProvider'],
    message: 'Groq does not support embeddings. Use a different EMBEDDING_PROVIDER.',
  });
}
```

### Provider-Specific Model Defaults (superRefine)

When `LLM_MODEL` is unset, apply provider-specific defaults:

```typescript
// Groq default model
if (val.llmProvider === 'groq' && val.llmModel === 'anthropic/claude-3.5-sonnet') {
  // The user didn't set LLM_MODEL explicitly — apply Groq default
  // (Note: zod default is 'anthropic/claude-3.5-sonnet', so we detect "not overridden")
  // We'll handle this in factory instead: if llmModel is the generic default, factory picks provider default
}
```

**Better approach**: Handle in factory. The config schema keeps generic defaults. Factory applies provider-specific defaults when the model matches the generic fallback:

```typescript
// In factory.ts, for Groq:
case 'groq':
  return new GroqClient({
    apiKey: config.groqApiKey,
    model: config.llmModel || 'llama-3.3-70b-versatile',
    // ...
  });
```

---

## 4. Factory Changes

### `src/llm/factory.ts`

```typescript
// Add imports
import { GroqClient } from './providers/groq.js';
import { GoogleClient } from './providers/google.js';

// In createLLMClient:
case 'groq':
  if (!config.groqApiKey) {
    throw new Error('GROQ_API_KEY is required when LLM_PROVIDER=groq');
  }
  return new GroqClient({
    apiKey: config.groqApiKey,
    model: config.llmModel || 'llama-3.3-70b-versatile',
    timeout: 60000,
  });

case 'google':
  if (!config.googleApiKey) {
    throw new Error('GOOGLE_API_KEY is required when LLM_PROVIDER=google');
  }
  return new GoogleClient({
    apiKey: config.googleApiKey,
    model: config.llmModel || 'gemini-2.0-flash',
    timeout: 60000,
    enableSearchGrounding: config.enableSearchGrounding,
  });

// In createEmbeddingClient:
case 'groq':
  throw new Error('Groq does not support embeddings. Use a different EMBEDDING_PROVIDER.');

case 'google':
  if (!config.googleApiKey) {
    throw new Error('GOOGLE_API_KEY is required when EMBEDDING_PROVIDER=google');
  }
  return new GoogleClient({
    apiKey: config.googleApiKey,
    model: config.llmModel || 'gemini-2.0-flash',
    embeddingModel: config.googleEmbeddingModel || 'text-embedding-004',
    embeddingDimensions: config.googleEmbeddingDimensions,
    timeout: 10000,
  });
```

### `src/llm/providers/groq.ts`

Thin wrapper — re-exports OpenAIClient with Groq preset:

```typescript
import { OpenAIClient, type OpenAIConfig } from './openai.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export type GroqConfig = Pick<OpenAIConfig, 'apiKey' | 'model' | 'timeout'>;

/**
 * Groq LLM provider — reuses OpenAIClient with Groq's OpenAI-compatible endpoint.
 * Groq does NOT support embeddings.
 */
export class GroqClient extends OpenAIClient {
  constructor(config: GroqConfig) {
    super({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: GROQ_BASE_URL,
      timeout: config.timeout,
    });
  }
}
```

### `src/llm/providers/google.ts`

Full native REST client — NO SDK dependency:

```typescript
import type { LLMClient, CompletionRequest, CompletionResponse, EmbeddingResponse } from '../interface.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('google');

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export interface GoogleConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  timeout?: number;
  enableSearchGrounding?: boolean;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface GeminiEmbedResponse {
  embedding?: { values?: number[] };
}

interface GeminiErrorResponse {
  error?: { code: number; message: string; status: string };
}

export class GoogleClient implements LLMClient {
  private readonly timeout: number;

  constructor(private readonly config: GoogleConfig) {
    this.timeout = config.timeout || 60000;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const start = Date.now();
    const url = `${GEMINI_BASE}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.3,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    };

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const errBody = await response.json() as GeminiErrorResponse;
      if (response.status === 429) {
        throw new Error('Google API rate limited. Please retry later.');
      }
      if (response.status === 403) {
        throw new Error('Google API authentication failed. Check your GOOGLE_API_KEY.');
      }
      throw new Error(`Google API error (${response.status}): ${errBody.error?.message || 'unknown'}`);
    }

    const data = await response.json() as GeminiGenerateResponse;
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const durationMs = Date.now() - start;

    log.info({ model: this.config.model, durationMs, tokens: data.usageMetadata }, 'completion finished');

    return {
      content,
      durationMs,
      tokenCount: {
        prompt: data.usageMetadata?.promptTokenCount || Math.ceil(request.prompt.length / 4),
        completion: data.usageMetadata?.candidatesTokenCount || Math.ceil(content.length / 4),
      },
    };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const start = Date.now();
    const model = this.config.embeddingModel || 'text-embedding-004';
    const url = `${GEMINI_BASE}/models/${model}:embedContent?key=${this.config.apiKey}`;

    const body: Record<string, unknown> = {
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
    };
    if (this.config.embeddingDimensions) {
      body.outputDimensionality = this.config.embeddingDimensions;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errBody = await response.json() as GeminiErrorResponse;
      throw new Error(`Google embedding error (${response.status}): ${errBody.error?.message || 'unknown'}`);
    }

    const data = await response.json() as GeminiEmbedResponse;
    if (!data.embedding?.values) {
      throw new Error('Google embedding response is missing the embedding vector');
    }

    return {
      embedding: data.embedding.values,
      durationMs: Date.now() - start,
    };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const url = `${GEMINI_BASE}/models?key=${this.config.apiKey}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

---

## 5. Test Structure

### `tests/unit/groq-provider.test.ts`

Follow the Bedrock test pattern — mock `fetch` globally:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('GroqClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends completion request to Groq base URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'hello from groq' } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      }),
    });

    const { GroqClient } = await import('../../src/llm/providers/groq.js');
    const client = new GroqClient({ apiKey: 'gsk_test', model: 'llama-3.3-70b-versatile' });
    const res = await client.complete({ prompt: 'hi', systemPrompt: 'sys' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('api.groq.com/openai/v1/chat/completions');
    expect(opts.method).toBe('POST');
    expect(res.content).toBe('hello from groq');
    expect(res.tokenCount).toEqual({ prompt: 5, completion: 3 });
  });

  it('falls back to heuristic token counts when usage is missing', async () => { /* ... */ });
  it('propagates 429 as rate limit error', async () => { /* ... */ });
  it('propagates 401 as auth error', async () => { /* ... */ });
  it('isHealthy returns true when API responds', async () => { /* ... */ });
  it('isHealthy returns false when fetch throws', async () => { /* ... */ });
});
```

### `tests/unit/google-provider.test.ts`

Same pattern — mock `fetch`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('GoogleClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('complete()', () => {
    it('sends completion to Gemini REST endpoint with API key in query', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'hello from gemini' }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        }),
      });

      const { GoogleClient } = await import('../../src/llm/providers/google.js');
      const client = new GoogleClient({ apiKey: 'AIza_test', model: 'gemini-2.0-flash' });
      const res = await client.complete({ prompt: 'hi', systemPrompt: 'sys' });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
      expect(url).toContain('key=AIza_test');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.systemInstruction).toEqual({ parts: [{ text: 'sys' }] });
      expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);

      expect(res.content).toBe('hello from gemini');
      expect(res.tokenCount).toEqual({ prompt: 10, completion: 5 });
    });

    it('omits systemInstruction when systemPrompt is empty', async () => { /* ... */ });
    it('falls back to heuristic token counts when usageMetadata is missing', async () => { /* ... */ });
    it('propagates 429 as rate limit error', async () => { /* ... */ });
    it('propagates 403 as auth error', async () => { /* ... */ });
  });

  describe('embed()', () => {
    it('sends embedding request to Gemini embedContent endpoint', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          embedding: { values: [0.1, 0.2, 0.3] },
        }),
      });

      const { GoogleClient } = await import('../../src/llm/providers/google.js');
      const client = new GoogleClient({
        apiKey: 'AIza_test',
        model: 'gemini-2.0-flash',
        embeddingModel: 'text-embedding-004',
        embeddingDimensions: 768,
      });
      const res = await client.embed('hello world');

      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('models/text-embedding-004:embedContent');

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.outputDimensionality).toBe(768);

      expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('throws when embedding response has no vector', async () => { /* ... */ });
  });

  describe('isHealthy()', () => {
    it('returns true when models list endpoint responds', async () => {
      fetchMock.mockResolvedValue({ ok: true });
      const { GoogleClient } = await import('../../src/llm/providers/google.js');
      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.isHealthy()).resolves.toBe(true);
    });

    it('returns false when fetch throws', async () => {
      fetchMock.mockRejectedValue(new Error('network'));
      const { GoogleClient } = await import('../../src/llm/providers/google.js');
      const client = new GoogleClient({ apiKey: 'k', model: 'm' });
      await expect(client.isHealthy()).resolves.toBe(false);
    });
  });
});
```

---

## 6. Execution Order

### Step 1: Config Schema Extension
**Files**: `src/config/index.ts`
- Add `'groq'` and `'google'` to `LLM_PROVIDERS` array
- Add `'google'` to `EMBEDDING_PROVIDERS` array
- Add new fields: `groqApiKey`, `groqModel`, `googleApiKey`, `googleModel`, `googleEmbeddingModel`, `googleEmbeddingDimensions`, `enableSearchGrounding`
- Add env var mappings in `loadConfig()`
- Add superRefine validations for API key presence and Groq embedding rejection

**Rationale**: Config must be ready before factory or providers, since both import `Config` type.

### Step 2: Groq Provider
**Files**: `src/llm/providers/groq.ts`
- Create `GroqClient` extending `OpenAIClient`
- Set `baseUrl` to `https://api.groq.com/openai/v1`
- No embedding support (throws in factory)

**Rationale**: Simplest change — pure composition, no new API surface.

### Step 3: Google Gemini Provider
**Files**: `src/llm/providers/google.ts`
- Create `GoogleClient` implementing `LLMClient`
- Native REST: `fetch` with API key in query param
- `complete()`: POST to `generateContent`, parse response
- `embed()`: POST to `embedContent`, parse response
- `isHealthy()`: GET to `models` endpoint
- Error handling: 429 → rate limit, 403 → auth, generic → pass-through

**Rationale**: Most complex new code — isolated in single file.

### Step 4: Provider Barrel Export
**Files**: `src/llm/providers/index.ts`
- Add `export { GroqClient } from './groq.js'`
- Add `export { GoogleClient } from './google.js'`
- Add type exports

### Step 5: Factory Extension
**Files**: `src/llm/factory.ts`
- Import `GroqClient` and `GoogleClient`
- Add `groq` case to `createLLMClient` (apiKey from `config.groqApiKey`)
- Add `google` case to `createLLMClient` (apiKey from `config.googleApiKey`)
- Add `groq` case to `createEmbeddingClient` → throw error
- Add `google` case to `createEmbeddingClient` (apiKey from `config.googleApiKey`)

### Step 6: Tests
**Files**: `tests/unit/groq-provider.test.ts`, `tests/unit/google-provider.test.ts`
- Mock `fetch` globally via `vi.stubGlobal`
- Test completion, embedding, health check, error propagation
- Follow Bedrock test structure (describe blocks, beforeEach reset, afterEach restore)

### Step 7: Verify
- Run full test suite: `pnpm test`
- All 241+ existing tests pass
- New tests pass
- No imports of Bedrock/OpenAI internals broken

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Gemini API shape changes | Pin to `v1beta` — stable for our use case |
| Groq model naming inconsistency | Use well-known defaults, document in README |
| API key leaks in logs | Keys only in query params, logger must redact; test asserts no key in error messages |
| Config validation order | superRefine runs after all fields parse — safe to reference `llmProvider` in checks |

---

## 8. Test Coverage Summary

| Component | Tests | Pattern |
|-----------|-------|---------|
| Groq provider | 6 tests | Mock fetch, verify URL/body/response parsing |
| Google provider | 9 tests | Mock fetch, verify URL params/systemInstruction/embedding |
| Config validation | Manual verification | Run `pnpm test` — existing config tests cover schema |
| Factory wiring | Covered by provider tests | Provider construction verified in provider tests |

---

*Design artifact for SDD multi-provider-llm change. Created: 2026-08-13*
