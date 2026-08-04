# ADR-0003: LLMClient Interface for Provider Agnosticism and Testability

## Status

Accepted (scope expanded by ADR-0013)

## Date

2026-08-04

## Context

The generation pipeline, RAG indexer, and structural validator all depend on an LLM for completion and embedding. Without an abstraction layer, testing these components requires a running Ollama instance — making unit tests slow, flaky, and environment-dependent.

However, the project principle "Build only today's abstractions" (Principle 5) cautions against creating interfaces for a single implementation. We need to balance testability against unnecessary indirection.

## Decision

We will introduce a **minimal LLMClient interface** with exactly three methods:

```typescript
interface LLMClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(text: string): Promise<EmbeddingResponse>;
  isHealthy(): Promise<boolean>;
}
```

The `OllamaClient` class implements this interface. In production, only `OllamaClient` is instantiated. In tests, a `MockLLMClient` returns predictable responses.

## Consequences

### Positive

- Generators can be unit-tested without Ollama running
- Property-based tests can use deterministic mock responses
- Integration tests can use a slower real Ollama instance
- The interface documents the exact contract generators depend on
- Future LLM providers (Bedrock, Phase 5) implement the same interface

### Negative

- One level of indirection in every LLM call (negligible runtime cost)
- Must maintain interface + implementation in sync (TypeScript compiler enforces this)

### What This Interface IS NOT

- Not a provider abstraction layer (no factory, no registry, no runtime switching)
- Not a port in hexagonal architecture (no adapter pattern, no dependency injection container)
- Not configurable at runtime (OllamaClient is hardcoded in the composition root)

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- A second LLMClient implementation is needed (Bedrock, OpenAI) — at that point, promote the interface to a proper Port with factory/configuration
- The interface needs methods beyond `complete`, `embed`, `isHealthy` (e.g., streaming, batch embedding, model listing)
- Test mocking becomes insufficient and requires a full in-memory LLM simulator

## Alternatives Considered

**No interface — mock the HTTP layer:** Rejected. Mocking `fetch` is brittle, couples tests to Ollama's API format, and doesn't document the semantic contract.

**Full Port/Adapter pattern:** Rejected. One implementation doesn't justify a port, adapter factory, and configuration-based provider switching. When we add Bedrock (Phase 5), we extract the pattern from the existing interface — 30 minutes of work.

**Test against real Ollama in CI:** Rejected. Requires GPU in CI, makes tests slow (~30s per LLM call), introduces flakiness from model nondeterminism.
