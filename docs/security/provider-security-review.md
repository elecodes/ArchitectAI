# Provider Security Review — Multi-Provider LLM Expansion (Phase 9)

## Scope

Security review of the multi-provider LLM expansion adding Google Gemini and Groq providers. Reviewed files:

- `src/llm/providers/google.ts` — new Google Gemini provider (native REST API)
- `src/llm/factory.ts` — updated factory with `groq` and `google` cases
- `src/config/index.ts` — updated Zod schema with `GOOGLE_API_KEY`, `GOOGLE_MODEL`, `GOOGLE_EMBEDDING_MODEL`

Existing providers reviewed for comparison: `openrouter.ts`, `openai.ts`, `bedrock.ts`.

---

## Review Checklist

### 1. API Key Safety

**Verdict: PASS**

- **Logger does not log keys.** All providers (including Google) log only `{ model, durationMs, tokens }` — confirmed in `google.ts:75`, `openrouter.ts:60`, `openai.ts:63`, `bedrock.ts:71`. Pino serialization captures no key material.
- **Factory does not log keys.** `createLLMClient` passes keys directly to provider constructors with no logging.
- **Config does not log keys.** `loadConfig()` validates via Zod but never logs raw env values.

**Note:** Google's API key is passed as a URL query parameter (`?key=`), not an `Authorization` header. This is discussed under finding #8 below.

### 2. Prompt/Response Exposure

**Verdict: PASS**

- Provider `complete()` methods accept `request.prompt` and `request.systemPrompt` and send them in the HTTP body to the provider. Neither prompts nor completions are logged by the application.
- `log.info` calls log `model`, `durationMs`, and `tokens` metadata only — never content.
- Embedding input (`text`) is similarly not logged in `embed()` methods.

### 3. Provider Error Sanitization

**Verdict: PASS**

- **Google provider** (`google.ts:61-69`): Returns sanitized status-code-based messages:
  - 429 → `'Google Gemini rate limited. Please retry later.'`
  - 400/403 → `'Google Gemini authentication failed. Check your API key.'`
  - Other → `'Google Gemini API error (${response.status})'`
  - The actual HTTP response body (which may contain request details, partial API keys in error messages, or provider internals) is **never included** in the thrown error.
- **Consistent with other providers**: OpenAI, OpenRouter, and Bedrock all follow the same pattern — status-code-based generic messages only.

### 4. Configuration Safety

**Verdict: PASS**

- All provider/model values are loaded from environment variables via `dotenv.config()` and validated through a strict Zod schema (`config/index.ts:12-153`).
- The schema uses `z.enum()` for provider selection (constrained to known values) and `z.string()` with defaults for models.
- No user-controlled configuration value can result in arbitrary command execution — all values are passed as strings to provider constructors, which use them in `fetch()` calls or SDK instantiation.
- The `superRefine()` block adds runtime validation (e.g., requiring API keys when a provider is selected, rejecting `mock` in production).

### 5. Ollama Safety

**Verdict: PASS**

- Ollama configuration (`factory.ts:30-36`): `config.ollamaUrl + '/v1'` is simple string concatenation.
- `ollamaUrl` defaults to `http://localhost:11434` (`config/index.ts:53`), sourced from `OLLAMA_URL` env var.
- No shell execution, no `exec()`, no `child_process` — only string concatenation passed to `OpenAIClient` constructor as a base URL for `fetch()`.

### 6. External Calls

**Verdict: PASS**

- All external provider calls are explicit `fetch()` invocations with:
  - `AbortSignal.timeout()` for request timeouts (60s default for completion, 10s for embeddings, 5s for health checks).
  - No hidden or implicit network calls.
  - No third-party HTTP libraries — Node.js native `fetch` only.
- Bedrock uses `@aws-sdk/client-bedrock-runtime` — AWS SDK default credential chain, no hardcoded credentials (`bedrock.ts:23-26`).

### 7. No Silent Paid Features

**Verdict: PASS**

- Google provider requires explicit `GOOGLE_API_KEY` env var. Factory throws immediately if missing (`factory.ts:53-56`). Config schema enforces this at validation time (`config/index.ts:147-153`).
- Groq provider follows the same pattern (`factory.ts:37-45`, `config/index.ts:139-145`).
- All providers default to `mock` or `openrouter` with an existing API key — no provider is silently activated.
- No new paid features are enabled by default; all require explicit opt-in via environment variables.

### 8. Google API Key in URL (`?key=` pattern)

**Verdict: PASS (with documented consideration)**

The Google Gemini REST API requires the API key as a URL query parameter (`?key=`), not a header. This appears in three places in `google.ts`:

- Line 52: `generateContent?key=${this.config.apiKey}`
- Line 91: `embedContent?key=${this.config.apiKey}`
- Line 117: `models/${this.config.model}?key=${this.config.apiKey}`

**Why this is safe in this context:**

1. **HTTPS only.** The base URL is `https://generativelanguage.googleapis.com/v1beta` — TLS encrypts the entire URL including query parameters in transit. No MITM can read the key.
2. **Server-side only.** This code runs in a Node.js backend, not a browser. Query parameters are not exposed in browser history, address bars, or referrer headers.
3. **No server-side logging.** Google's API endpoint does not log query parameters to application-accessible logs. The application itself does not log request URLs.
4. **Google's documented pattern.** This is the official Google Gemini REST API authentication method — not a workaround.

**Risk:** Low. The key is transmitted over HTTPS and never logged. The only theoretical exposure vector is a TLS downgrade attack (mitigated by modern infrastructure) or a logging proxy between the server and Google (unlikely in standard deployments).

---

## Summary

| Check | Status | Notes |
|-------|--------|-------|
| 1. API key safety | PASS | Keys not logged anywhere |
| 2. Prompt/response exposure | PASS | Only tokens/metadata logged |
| 3. Error sanitization | PASS | Status-code-only messages |
| 4. Configuration safety | PASS | Zod-validated env vars only |
| 5. Ollama safety | PASS | String concat, no shell |
| 6. External calls | PASS | Explicit fetch + timeouts |
| 7. No silent paid features | PASS | All require explicit API keys |
| 8. Google `?key=` pattern | PASS | HTTPS, server-side, documented |

## Issues Found

None. No security issues identified in the new provider additions.

## Recommendations

1. **No action required** for the current implementation. The Google `?key=` pattern is the official API design and is safe in a server-side HTTPS context.
2. **Future consideration**: If request URLs are ever logged (e.g., debug logging enabled), API keys would be exposed in query parameters. Ensure log level configuration does not enable URL-level debug logging in production. This is not a current issue — no URL logging exists.
3. The `generateContent?key=` URL is constructed via template literal (`google.ts:52`). If the `apiKey` config field ever accepted untrusted input, this could enable URL injection. Current trust boundary (env vars only) makes this a non-issue.
