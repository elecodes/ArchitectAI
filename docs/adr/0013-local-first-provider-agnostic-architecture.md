# ADR-0013: Local-First, Provider-Agnostic AI Architecture

## Status

Accepted (supersedes ADR-0008: Ollama as Sole LLM Provider)

## Date

2026-08-04

## Context

ADR-0008 established Ollama as the sole LLM provider for MVP, justified by the "local-only" philosophy. This created an implicit hardware constraint: developers need a machine capable of running a 7B+ parameter model (~8-10GB RAM for Ollama alone, plus GPU for acceptable speed).

In practice, this constraint:

- **Excludes developers without powerful hardware.** A developer on a 16GB laptop with no discrete GPU faces 30-60s generation times with CPU-only inference.
- **Conflates "local development" with "local inference."** The application runs locally either way — the question is where the LLM inference happens.
- **Delays cloud LLM integration to Phase 5.** But cloud providers (OpenRouter, OpenAI) offer higher quality output, faster inference, and no hardware requirements TODAY.
- **Creates a false dichotomy.** "Local-first. Cloud-ready." — the development experience is local, the data stays local, and the infrastructure is simple. The AI provider is a configuration choice.

The existing `LLMClient` interface (ADR-0003) was already designed for testability. It naturally extends to support multiple providers without additional abstraction.

## Decision

ArchitectAI is **Local-first. Cloud-ready.**

This means:

1. The application, database, and development tooling always run locally (Docker Compose)
2. The LLM provider is configurable via environment variable: `LLM_PROVIDER=openrouter|openai|ollama|mock`
3. Cloud LLM providers (OpenRouter, OpenAI) are **first-class citizens**, not secondary adapters
4. Ollama is supported but **optional** — no GPU requirement for MVP
5. The `LLMClient` interface remains the sole abstraction — each provider implements it
6. No provider-specific logic leaks into generation, RAG, or pipeline code

**Supported providers for MVP:**

| Provider   | Use Case                    | Requirements          |
| ---------- | --------------------------- | --------------------- |
| OpenRouter | Default for most developers | API key + internet    |
| OpenAI     | Direct OpenAI access        | API key + internet    |
| Ollama     | Offline/privacy-sensitive   | Local GPU or patience |
| Mock       | Testing                     | Nothing               |

**Configuration:**

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-...
LLM_MODEL=anthropic/claude-3.5-sonnet
LLM_CONTEXT_WINDOW=128000

EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=sk-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

The LLM provider and embedding provider can be configured independently (e.g., use OpenRouter for generation but OpenAI for embeddings).

## Consequences

### Positive

- **Easier onboarding.** Any developer with Docker + Node.js + internet connection can run the full system. No GPU required.
- **Better output quality.** Cloud models (Claude, GPT-4) produce significantly better architecture reasoning than local 7B models.
- **Faster iteration.** Cloud inference is typically 5-15s vs 30-60s for local CPU inference.
- **Better testing.** Mock provider enables fully deterministic tests without any infrastructure.
- **Cleaner architecture.** The abstraction is justified NOW (4 providers, not 1). This satisfies Principle 5.
- **Easier future AWS migration.** Adding Bedrock is just another provider implementation.
- **Cost flexibility.** Users choose their cost/quality tradeoff (free local, cheap OpenRouter, premium OpenAI).

### Negative

- **Internet dependency for cloud providers.** Not usable on a plane or in air-gapped environments unless using Ollama.
- **API key management.** Users must obtain and configure API keys. Adds onboarding friction.
- **Cost for cloud inference.** Not free — estimated $0.01-0.10 per generation depending on model and token count.
- **Provider outages.** Cloud providers can have downtime (Ollama is always available locally).
- **Variable context windows.** Different providers/models have different context limits — Context Window Manager must be configurable per provider.

### Migration from ADR-0008

- ADR-0008 (Ollama as sole provider) is **superseded** by this ADR
- The `OllamaClient` class remains but becomes one of four `LLMClient` implementations
- Docker Compose no longer includes Ollama by default — it's an optional profile
- Default configuration uses OpenRouter (lowest barrier to entry)
- All existing generation, RAG, and pipeline code remains unchanged (they depend on `LLMClient` interface, not `OllamaClient`)

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- A provider introduces a fundamentally different interaction model that cannot be represented by `complete()` + `embed()` (e.g., persistent sessions, tool use, multi-turn)
- The interface needs more than 5 methods to accommodate provider differences
- Local inference quality matches cloud providers at comparable speed (making cloud unnecessary)
- Enterprise security policy prohibits sending ANY data to third-party APIs (even with contractual guarantees)

## Alternatives Considered

**Keep Ollama-only (ADR-0008):** Rejected. Creates unnecessary hardware barrier. Most developers don't have a GPU. The "local-only" philosophy was solving the wrong problem — we wanted local development, not local inference.

**Abstract behind a full Plugin Framework:** Rejected. A plugin discovery system, dynamic loading, and extension points is over-engineering. The `LLMClient` interface with 3 methods and a switch statement in the factory function is sufficient. Principle 1: prefer simplicity.

**Support only OpenAI:** Rejected. Vendor lock-in to a single cloud provider. OpenRouter provides access to multiple models (Claude, GPT-4, Llama, Mistral) through one API — better flexibility.

**Separate "providers" package:** Rejected. In a monolith, a separate package adds build complexity for no benefit. Provider implementations live in `src/llm/providers/` as simple files.
