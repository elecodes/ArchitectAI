# ADR-0008: Ollama as Sole LLM Provider for MVP

## Status

Superseded by [ADR-0013](0013-local-first-provider-agnostic-architecture.md)

## Date

2026-08-04

## Context

ArchitectAI requires an LLM for:

- Text generation (specification, architecture, task breakdown)
- Embedding generation (RAG indexing and retrieval)
- Structural validation (optional)

Provider options considered:

1. **Ollama** — local model serving, no cloud dependency, free
2. **OpenAI API** — high quality, requires internet, costs money
3. **AWS Bedrock** — enterprise-grade, requires AWS account, costs money
4. **vLLM / llama.cpp** — alternative local serving, more configuration

The product requirement is: "Run completely locally with zero internet dependency after initial setup."

## Decision

We will use **Ollama** as the sole LLM provider for MVP:

- Generation model: `llama3.1:8b` (configurable via `OLLAMA_MODEL` env var)
- Embedding model: `nomic-embed-text` (768 dimensions)
- Served via Docker container alongside the application

## Consequences

### Positive

- Zero internet dependency after model download
- Zero cost per inference (no API bills)
- User owns their data — nothing leaves the machine
- Simple Docker deployment — Ollama has an official image
- Model selection is user-configurable without code changes
- Consistent latency (no network variability)

### Negative

- Output quality significantly lower than GPT-4 or Claude for complex reasoning tasks
- Limited context window (8192 tokens for most 7B-8B models)
- Requires significant RAM (~8-10GB for an 8B model)
- No structured output mode (must validate and retry)
- Model updates depend on Ollama release cadence

### Honest Limitations

Users should expect:

- Architecture documents may require significant human editing
- Complex specifications may need multiple iterations
- The system is a "first draft" generator, not a finished-product generator
- Task breakdowns will need human refinement for dependencies

This is explicitly communicated via Principle 6: "Human judgment always overrides AI" and UI language ("draft", "suggested").

### Model Recommendations

| Use Case                       | Model               | RAM    | Context | Quality       |
| ------------------------------ | ------------------- | ------ | ------- | ------------- |
| General generation             | llama3.1:8b         | ~8GB   | 8192    | Good          |
| Code-heavy specs               | deepseek-coder:6.7b | ~6GB   | 16384   | Good for code |
| Higher quality (if RAM allows) | llama3.1:70b-q4     | ~40GB  | 8192    | Better        |
| Embeddings                     | nomic-embed-text    | ~300MB | —       | Good          |

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- User feedback consistently shows output quality is insufficient for the use case (may need a cloud model option)
- Ollama becomes unmaintained or a superior local serving solution emerges
- An enterprise customer requires a cloud LLM provider (Phase 5 trigger)
- Models with >32K context windows become standard and require a different serving approach
- Apple Silicon Neural Engine or local GPU acceleration becomes better supported by an alternative runtime

## Alternatives Considered

**OpenAI API:** Rejected. Contradicts local-first requirement. Adds internet dependency, API key management, and usage costs. Quality advantage is real but disqualifying for MVP.

**AWS Bedrock:** Rejected for MVP. Requires AWS account, IAM configuration, and network access. Planned for Phase 5 as an optional adapter.

**vLLM / llama.cpp directly:** Rejected. More complex to configure than Ollama. Ollama wraps llama.cpp with a clean REST API and Docker image. Less operational overhead.

**Multiple local models (generation + review):** Rejected. Running two models simultaneously on 16GB RAM is impractical. The structural validator uses the same model with a different prompt.
