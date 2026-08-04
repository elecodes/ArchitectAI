# Architecture Decision Records

This directory contains the Architecture Decision Records (ADRs) for ArchitectAI.

ADRs document significant architectural decisions, their context, the decision made, consequences, and alternatives considered. They follow the [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Index

| ADR                                                         | Title                                           | Status     | Date       |
| ----------------------------------------------------------- | ----------------------------------------------- | ---------- | ---------- |
| [0001](0001-modular-monolith-architecture.md)               | Modular Monolith Architecture                   | Accepted   | 2026-08-04 |
| [0002](0002-sequential-pipeline-over-agent-orchestrator.md) | Sequential Pipeline Over Agent Orchestrator     | Accepted   | 2026-08-04 |
| [0003](0003-llm-client-interface-for-testability.md)        | Minimal LLMClient Interface for Testability     | Accepted   | 2026-08-04 |
| [0004](0004-context-window-budget-management.md)            | Context Window Budget Management                | Accepted   | 2026-08-04 |
| [0005](0005-llm-output-validation-and-retry.md)             | LLM Output Validation and Bounded Retry         | Accepted   | 2026-08-04 |
| [0006](0006-prompt-versioning-and-provenance.md)            | Prompt Versioning and Artifact Provenance       | Accepted   | 2026-08-04 |
| [0007](0007-structural-validator-over-self-review.md)       | Structural Validator Replaces Self-Review       | Accepted   | 2026-08-04 |
| [0008](0008-ollama-as-sole-llm-provider.md)                 | Ollama as Sole LLM Provider for MVP             | Superseded | 2026-08-04 |
| [0009](0009-pgvector-for-rag-retrieval.md)                  | PostgreSQL + pgvector for RAG Retrieval         | Accepted   | 2026-08-04 |
| [0010](0010-fixed-size-chunking-for-mvp.md)                 | Fixed-Size Chunking Strategy for MVP            | Accepted   | 2026-08-04 |
| [0011](0011-prompt-injection-protection-via-delimiters.md)  | Prompt Injection Protection via Delimiters      | Accepted   | 2026-08-04 |
| [0012](0012-ai-telemetry-over-general-observability.md)     | AI-Focused Telemetry Over General Observability | Accepted   | 2026-08-04 |
| [0013](0013-local-first-provider-agnostic-architecture.md)  | Local-First, Provider-Agnostic AI Architecture  | Accepted   | 2026-08-04 |

## How to Add a New ADR

1. Create a new file: `docs/adr/NNNN-short-title.md`
2. Use the template below
3. Status should be `Proposed` until reviewed, then `Accepted` or `Rejected`
4. Link it in this README index

## Template

```markdown
# ADR-NNNN: Title

## Status

Proposed | Accepted | Deprecated | Superseded by [ADR-NNNN](link)

## Date

YYYY-MM-DD

## Context

What is the issue that we're seeing that is motivating this decision?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive

### Negative

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- [Condition 1]
- [Condition 2]
- [Condition 3]

## Alternatives Considered
```

## Conventions

- ADRs are immutable once accepted. To change a decision, create a new ADR that supersedes the old one.
- Short titles in kebab-case for filenames.
- Each ADR should be self-contained — readable without needing to reference other documents.
- Reference Engineering Constitution principles when they apply.
- **Every ADR MUST include a Review Trigger section** listing concrete, measurable conditions that would cause the team to re-evaluate the decision.
