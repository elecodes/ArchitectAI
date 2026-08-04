# ADR-0001: Modular Monolith Architecture

## Status

Accepted

## Date

2026-08-04

## Context

ArchitectAI is a new platform being built by a single senior engineer with a 10-week timeline. The system involves multiple functional domains: specification generation, architecture document generation, task breakdown, RAG retrieval, structural validation, and a web UI.

The team considered three architectural styles:

1. **Microservices** — each domain as an independent deployable service
2. **Modular Monolith** — single process with well-defined module boundaries
3. **Serverless** — each function as a cloud lambda

Constraints:

- Single engineer for 10 weeks
- Must run fully locally with Docker
- Must be debuggable without distributed tracing infrastructure
- Must support future extraction of modules if scaling demands it

## Decision

We will build ArchitectAI as a **modular monolith** — a single Express.js Node.js process with clearly separated internal modules communicating via direct function calls.

## Consequences

### Positive

- Single process means shared TypeScript types, no serialization overhead, no inter-service networking
- Debugging is straightforward — one stack trace, one log stream
- Deployment is one Docker container (plus Ollama and PostgreSQL)
- Development velocity is maximized — no coordination overhead between services
- Module boundaries allow future extraction if a module becomes a bottleneck

### Negative

- All modules share the same process memory — a memory leak in RAG indexing affects the entire application
- Cannot scale modules independently (e.g., cannot run 3 instances of the generation module and 1 of the API)
- Single point of failure — if the process crashes, everything stops

### Risks

- If the RAG indexing of large projects blocks the event loop, API responsiveness degrades. Mitigation: async indexing with worker threads if measurements show blocking.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- Team grows beyond 4 engineers working on the same codebase simultaneously
- A specific module (e.g., RAG indexing) consistently blocks the event loop for >5 seconds, measured via telemetry
- Deployment requires independent scaling of a component (e.g., 3 API instances but 1 RAG indexer)
- The monolith binary exceeds 500MB or cold start exceeds 10 seconds

## Alternatives Considered

**Microservices:** Rejected. Multiplies deployment complexity, requires service discovery, adds network latency between components, needs distributed tracing. All overhead for zero benefit at single-engineer scale.

**Serverless:** Rejected. Requires cloud dependency (contradicts local-first requirement). Cold starts add unpredictable latency to LLM operations that already take 30 seconds.
