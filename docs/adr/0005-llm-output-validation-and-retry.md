# ADR-0005: LLM Output Validation and Bounded Retry

## Status

Accepted

## Date

2026-08-04

## Context

Local 7B-8B parameter models produce invalid JSON output at a significant rate (estimated 20-30% of calls depending on prompt complexity). Failure modes include:

- Incomplete JSON (model stops mid-object)
- Markdown-wrapped JSON (`json ... `)
- Extra text before/after JSON body
- Valid JSON with missing required fields
- Valid JSON with wrong field types
- Hallucinated field names not in schema

Without validation, the system silently persists malformed data and displays garbage to users. The architecture review identified this as a P0 correctness issue.

## Decision

We will implement a **two-stage validation with bounded retry**:

**Stage 1 — JSON Parse:**

- Strip markdown code blocks if present
- Attempt `JSON.parse`
- On failure: proceed to retry

**Stage 2 — Schema Validation:**

- Apply zod schema for the expected output type
- On failure: proceed to retry

**Retry (maximum 1):**

- Re-call the LLM with a stricter system prompt
- Include the error message in the retry prompt so the model can self-correct
- Apply the same two-stage validation
- On second failure: throw `GenerationError` with full diagnostic context

**Never retry:**

- Timeout (resource exhaustion — retrying wastes more time)
- Connection refused (infrastructure failure)
- Authentication error (configuration failure)

## Consequences

### Positive

- Recovers 60-80% of first-attempt failures (based on industry data for retry-with-error-feedback)
- Every persisted artifact is guaranteed to pass schema validation
- Failed attempts are logged with raw output for debugging prompt issues
- Clear error to user when retry also fails — no silent garbage

### Negative

- Worst case: doubles latency (30s + 30s = 60s) on validation failure
- Additional LLM call consumes tokens (acceptable for correctness)
- Retry prompt must be maintained as versioned file (retry-v1.md)

### Why Maximum 1 Retry

Diminishing returns: if the model cannot produce valid output in 2 attempts with error feedback, a third attempt is unlikely to succeed. The model either doesn't understand the schema or the prompt is fundamentally flawed. Better to fail fast and let the engineer investigate.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- Ollama adds reliable structured output / JSON mode for the models we use (retry may become unnecessary)
- Telemetry shows retry success rate drops below 40% (the retry is wasting latency without recovering)
- Telemetry shows first-attempt success rate exceeds 95% (retry logic is dead code — simplify)
- A model produces consistently valid JSON without retry (validation can be relaxed to schema-only)
- Users report that 60s worst-case latency (generation + retry) is unacceptable

## Alternatives Considered

**No retry — fail immediately:** Rejected. 20-30% failure rate means users would see errors on every 3rd-5th request. Unacceptable UX.

**Multiple retries (3-5):** Rejected. Each retry adds 30s latency. The recovery rate curve flattens after the first retry. 2 attempts is the sweet spot of recovery vs latency.

**Structured output mode (if available):** Noted for future. Some models support constrained JSON generation. When Ollama supports this reliably, it may replace retry. Not available consistently in 2026 across all models we target.

**Client-side JSON repair (e.g., json-repair library):** Rejected for MVP. Repair libraries can produce syntactically valid but semantically wrong JSON. Better to let the model retry with explicit error context.
