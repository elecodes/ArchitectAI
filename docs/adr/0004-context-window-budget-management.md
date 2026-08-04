# ADR-0004: Context Window Budget Management

## Status

Accepted

## Date

2026-08-04

## Context

Local LLMs (llama3.1:8b, mistral:7b) have finite context windows, typically 8192 tokens. Every LLM call in ArchitectAI includes:

- System prompt (~500-1000 tokens): engineering principles, output schema, few-shot examples
- User input (~200-2000 tokens): feature description or specification
- RAG context (~2500 tokens): 5 chunks × ~512 tokens each
- Reserved output (~2048 tokens): space for the model to generate

Total: ~5250-7548 tokens before generation. On an 8192-token model, this leaves minimal headroom. With a larger user input or more RAG chunks, the context OVERFLOWS silently — the model receives truncated input and produces garbage.

This was identified as the #1 technical risk in the architecture review.

## Decision

We will introduce a **Context Window Manager** that calculates the token budget before every LLM call and progressively removes RAG chunks (lowest similarity first) if the budget is exceeded.

The manager:

1. Pre-calculates system prompt tokens at startup (per prompt version)
2. Estimates user input tokens at request time
3. Computes available budget for RAG: `contextWindow - systemTokens - inputTokens - reservedOutput`
4. Includes RAG chunks greedily (highest similarity first) until budget is exhausted
5. Logs a truncation event if any chunks were dropped

## Consequences

### Positive

- Prevents silent context overflow — the #1 cause of garbage output
- Progressive degradation — most relevant context is always included
- Truncation is logged — engineers can see when context is being dropped
- Users can tune: increase context window (bigger model) or reduce RAG chunks

### Negative

- Token estimation via `chars / 4` is imprecise (acknowledged, see P2 for proper tokenizer)
- An extra computation step before every LLM call (~1ms overhead — negligible)
- Users may not realize their RAG context is being truncated unless they check logs

### Token Estimation Strategy

MVP uses `Math.ceil(text.length / 4)` as a heuristic. This is:

- Accurate within ±20% for English prose
- Less accurate for code (short tokens, underestimates)
- Sufficient for MVP because the manager handles overflow gracefully (truncation, not crash)

Upgrade path: replace with `gpt-tokenizer` package in Phase 1.5 when telemetry shows frequent truncation.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- Telemetry shows truncation occurring on >30% of requests (heuristic is too imprecise — switch to proper tokenizer)
- A model with 128K+ context window becomes the default (budget math changes, RAG chunk limits may become irrelevant)
- Multiple models with different context windows are used simultaneously (need per-model budget config)
- Users report poor output quality correlated with truncation events in telemetry

## Alternatives Considered

**Trust the model to handle overflow:** Rejected. Models do NOT handle overflow gracefully. They silently truncate from the end or produce incoherent output. There is no error signal.

**Hard-reject requests that exceed budget:** Rejected. Too restrictive. Users shouldn't need to understand token math. Progressive truncation maintains usability.

**Use only small prompts to avoid overflow:** Rejected. System prompts with few-shot examples and engineering principles are large by necessity. The quality of output depends on prompt quality.
