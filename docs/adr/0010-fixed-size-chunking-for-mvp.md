# ADR-0010: Fixed-Size Chunking Strategy for MVP

## Status

Accepted

## Date

2026-08-04

## Context

RAG retrieval requires splitting project files into chunks before embedding. The chunking strategy directly impacts retrieval quality — too large and chunks are unfocused; too small and they lose context.

Chunking strategies considered:

1. **Fixed-size** — split by token count, respect paragraph boundaries
2. **Semantic** — split at natural topic boundaries using NLP or LLM
3. **AST-based** — split code files at function/class boundaries using language parsers
4. **Recursive character splitting** — split with overlap, respecting hierarchy (headings, paragraphs)

## Decision

We will use **fixed-size chunking** (512 tokens default, configurable 128-2048) for MVP. Split at paragraph boundaries (`\n\n`) to avoid cutting mid-sentence. Token estimation via `chars / 4` heuristic.

## Consequences

### Positive

- Zero external dependencies (no NLP libraries, no language parsers)
- Deterministic and fast (~1ms per file)
- Predictable chunk sizes simplify context window budgeting
- Easy to test with property-based tests (content round-trip)
- Works for both prose (docs) and code (acceptable, not optimal)

### Negative

- Code functions may be split across chunks (loses semantic coherence)
- Related paragraphs may be separated (a definition and its usage)
- No overlap between chunks — boundary information may be lost
- Token estimation is imprecise for code files (symbols tokenize differently)

### Why 512 Tokens Default

- With 5 chunks per retrieval and 8192 context window: 5 × 512 = 2,560 tokens for RAG context
- Leaves ~5,632 tokens for system prompt, user input, and output
- Balances chunk specificity (smaller = more focused) with context coherence (larger = more complete)
- Aligns with common embedding model training (most trained on ~512 token passages)

### Correctness Property

The chunker must satisfy: for any input text, the concatenation of all produced chunks equals the original text. No content is lost, added, or reordered.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- Telemetry shows retrieval precision below 50% (retrieved chunks are not relevant to queries)
- Users report that RAG context for code files is consistently unhelpful
- Average similarity scores in telemetry are below 0.4 (chunks are too generic to match queries)
- The system indexes projects with >1000 files (scale may require smarter chunking)
- A lightweight AST parsing library becomes available with minimal dependency footprint

## Alternatives Considered

**Semantic chunking:** Rejected for MVP. Requires NLP model or additional LLM calls per file. Adds latency, complexity, and a dependency. Revisit in Phase 2 if telemetry shows poor retrieval precision.

**AST-based chunking for code:** Rejected for MVP. Requires language-specific parsers (TypeScript, Python, Java, etc.). Each parser is a dependency to maintain. Revisit when users report that code retrieval is poor.

**Recursive character splitting with overlap:** Partially considered. Overlap (e.g., 50 token overlap between chunks) improves boundary coherence but increases storage by ~10% and complicates the content round-trip property. Defer to Phase 2.

**LLM-based chunking (ask the model to find boundaries):** Rejected. Absurdly expensive — an LLM call per file just for chunking. Cost/benefit is clearly negative.
