# ADR-0012: AI-Focused Telemetry Over General Observability

## Status

Accepted

## Date

2026-08-04

## Context

The original requirements specified a comprehensive observability system including: structured logs, provenance tracking, health-check endpoints, WebSocket progress events, audit log retention with auto-deletion, and resource utilization alerting.

For an AI engineering system, general application observability (request logs, error rates, response times) is necessary but insufficient. The critical operational questions are AI-specific:

- How many tokens does each generation consume?
- How often does the output validator trigger retries?
- Is the context window being truncated? How often?
- What's the retrieval quality (similarity scores)?
- Which prompt versions produce better user feedback?

## Decision

We will implement **AI-focused generation telemetry** that captures per-generation metrics rather than general application monitoring.

Every generation records:

- Timing: generation duration, embedding duration, retrieval duration, total duration
- Tokens: prompt tokens, completion tokens, total tokens
- RAG: chunks retrieved, chunks fitted after context window trimming, similarity scores, truncation flag
- Context: window size, tokens used, utilization percentage
- Outcome: success / validation_retry / failure, retry count, error category
- Provenance: model, prompt version

This data is persisted to a `generation_telemetry` table and emitted as structured JSON to stdout.

## Consequences

### Positive

- Enables data-driven decisions about model selection, prompt improvements, and RAG tuning
- Tracks the specific metrics that predict AI output quality
- Replaces general audit_logs with richer, more actionable data
- Foundation for future evaluation infrastructure (Phase 4)
- Structured JSON stdout integrates with any log aggregation tool

### Negative

- More data per request than a simple audit log (~500 bytes vs ~100 bytes)
- Telemetry insert adds ~5ms to each request (negligible vs 30s generation)
- No visualization in MVP — data accumulates until dashboard is built (Phase 2)

### What We Explicitly Defer

- Prometheus metrics endpoint
- Grafana dashboards
- Real-time alerting
- WebSocket progress events
- Resource utilization monitoring
- Log retention auto-deletion (table grows indefinitely in MVP — acceptable for months of single-user data)

These are all Phase 2-5 concerns. The INVESTMENT is the telemetry table schema — visualization layers on top of it are trivial to add later.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- The telemetry table exceeds 1GB and queries become slow (need partitioning, archival, or summary tables)
- The team needs real-time dashboards and alerting (integrate with Grafana/Prometheus or build a visualization layer)
- Enterprise customers require OpenTelemetry-compatible telemetry export
- The telemetry schema needs fields not anticipated here (frequent ALTER TABLE = schema doesn't fit the domain)
- Cost tracking per generation becomes a product requirement (need token pricing data)

## Alternatives Considered

**General audit_logs table only:** Rejected. Captures timing and status but misses token usage, context window utilization, and RAG quality — the metrics that actually matter for AI system improvement.

**OpenTelemetry integration:** Rejected for MVP. OTel adds significant configuration overhead (collectors, exporters, backends). The structured JSON table achieves 90% of the value with 10% of the complexity. Add OTel export in Phase 5 for enterprise monitoring.

**No telemetry — optimize later:** Rejected. Violates Principle 4 (Measure before optimizing) and Principle 9 (Observability is not optional). Without data, you cannot improve prompts, tune RAG, or debug quality regressions.
