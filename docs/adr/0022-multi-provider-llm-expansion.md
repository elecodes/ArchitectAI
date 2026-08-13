# ADR-0022: Multi-Provider LLM Expansion (Groq + Google Gemini)

## Status

Accepted

## Date

2026-08-13

## Context

ArchitectAI v1.5.0 supports 5 LLM providers: OpenRouter, OpenAI, Ollama, Bedrock, and Mock. Users have requested faster inference options (Groq) and free-tier access (Google Gemini) to reduce cost barriers during development.

Two pressures drove this expansion:

1. **Cost barrier for experimentation.** OpenRouter/OpenAI require paid API keys. Groq and Google Gemini offer free tiers that let developers prototype without credit cards.
2. **Inference speed.** Groq's purpose-built hardware delivers 10-100x faster inference than general-purpose APIs, dramatically improving the generation experience.

The standing provider architecture (ADR-0003: LLMClient interface, ADR-0013: provider-agnostic) makes adding providers a factory change, not an architectural one. The constraint is: **no new dependencies, no SDK lock-in, no compromise to local-first.**

## Decision

Add Groq and Google Gemini as LLM providers, with Google also supporting embeddings.

### Groq: Reuses OpenAIClient

Groq exposes an OpenAI-compatible API (`/openai/v1`). Rather than writing a new client class, the factory instantiates `OpenAIClient` with Groq's base URL:

```typescript
case 'groq':
  return new OpenAIClient({
    apiKey: config.groqApiKey,
    model: config.groqModel,
    baseUrl: 'https://api.groq.com/openai/v1',
  });
```

**Why this works**: Groq's API is wire-compatible with OpenAI's chat completions format. The `OpenAIClient` already handles request/response serialization, so no new code is needed. This is the same pattern used for Ollama (also OpenAI-compatible).

**Embedding limitation**: Groq does not support an embedding API. The factory throws a descriptive error directing users to OpenAI, Google, or Ollama for embeddings.

### Google Gemini: Native REST (No SDK)

Google Gemini uses the native REST API directly via `fetch`, with no `@google/generative-ai` SDK dependency:

- **LLM**: POST to `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
- **Embeddings**: POST to `generativelanguage.googleapis.com/v1beta/models/{model}:embedContent`
- **Health**: GET `generativelanguage.googleapis.com/v1beta/models/{model}`

**Why native REST**: The `@google/generative-ai` SDK adds ~200KB to the bundle and introduces a dependency that can break on version bumps. The REST surface is stable, well-documented, and requires only `fetch` — already available in Node.js. Authentication is via API key as a query parameter (required by the API), which means the key appears in the URL but never in error messages or logs.

**Embedding model**: Defaults to `text-embedding-004` (Google's current production embedding model). Configurable via `GOOGLE_EMBEDDING_MODEL`.

### Cost Safety

No provider changes the cost model:

- All providers are **pay-per-use** — no provisioned resources, no minimums.
- ArchitectAI never sends LLM prompts without explicit user action (generate, review, etc.).
- No background calls, no batching, no hidden costs.
- Free-tier providers (Groq, Google) have rate limits but no charges.
- The telemetry system records `provider` per generation, so costs remain attributable.

### Embedding Strategy

| Provider | Supports Embeddings | Default Model |
|----------|-------------------|---------------|
| OpenRouter | ✅ | (user-specified) |
| OpenAI | ✅ | text-embedding-3-small |
| Bedrock | ✅ | amazon.titan-embed-text-v1 |
| Google | ✅ | text-embedding-004 |
| Ollama | ✅ | (user-specified) |
| Groq | ❌ | — |
| Mock | ✅ | — |

Groq is excluded from `EMBEDDING_PROVIDERS` at the Zod schema level — attempting `EMBEDDING_PROVIDER=groq` produces a validation error before any runtime code executes.

## Consequences

### Positive

- **Free-tier access.** Developers can prototype with Groq (fast) or Google (generous free quota) without API keys from paid providers.
- **Zero new dependencies.** Groq reuses `OpenAIClient`; Google uses native `fetch`. No SDK additions to `package.json`.
- **Consistent architecture.** Both providers implement the existing `LLMClient` interface. Factory wiring follows the established pattern.
- **Embedding flexibility.** Google adds a 6th embedding provider, giving users more options for the RAG pipeline.

### Negative

- **Config surface grows.** 5 new environment variables (`GROQ_API_KEY`, `GROQ_MODEL`, `GOOGLE_API_KEY`, `GOOGLE_MODEL`, `GOOGLE_EMBEDDING_MODEL`). Mitigated by sensible defaults — only API keys are required.
- **Google API key in URL.** The Gemini REST API requires the key as a query parameter, not a header. This means the key could appear in server logs if not careful. Mitigated by never logging the full URL and the key being a per-project credential, not a root secret.
- **Groq embedding gap.** Users must configure a separate embedding provider when using Groq for LLM. This is documented and produces a clear error message.

## Alternatives Considered

**Use `@google/generative-ai` SDK**: Rejected. Adds a dependency for what amounts to 3 HTTP calls. The REST surface is stable and the SDK would need version pinning and update maintenance.

**Route Groq through OpenRouter**: Rejected. Defeats the purpose — Groq's value is direct access to its fast inference hardware. OpenRouter adds latency and cost.

**Add Azure OpenAI as a 7th provider**: Deferred. Azure requires deployment-level configuration (endpoint + deployment ID) which is a different mental model. The current 7 providers cover the primary use cases.

## Review Trigger

Re-evaluate when:

- Groq adds embedding support (add to `EMBEDDING_PROVIDERS`)
- Google changes its REST API version (currently `v1beta`)
- A provider requires OAuth/service-account auth instead of API keys
- The config surface exceeds 10 provider-specific variables (consider a provider config file)
