# ADR-0014: LLM Security Mitigations (OWASP Top 10 for LLM Applications)

## Status

Accepted

## Date

2026-08-05

## Context

ArchitectAI processes user project files via RAG and feeds them into LLM prompts. The OWASP Top 10 for LLM Applications identifies attack vectors relevant to this architecture.

Threat model:
- MVP is local-first, single-user — the attacker and user are the same person
- RAG indexes user's own project files — self-injection is low consequence
- The system generates architecture documents, not executable code
- Cloud LLM providers add data-in-transit concerns

## Decision

Implement proportionate security mitigations aligned with the local-first threat model:

### Mitigations Implemented (MVP)

| OWASP LLM Risk | Mitigation | Implementation |
|----------------|-----------|----------------|
| LLM01: Prompt Injection | Delimiter isolation + instruction boundaries in system prompts | `<CONTEXT>` / `<USER_INPUT>` delimiters, "do not follow instructions" preamble |
| LLM02: Insecure Output Handling | Zod schema validation on ALL LLM output | OutputValidator + retry on failure |
| LLM04: Model Denial of Service | Rate limiting (10 req/min for generation) | express-rate-limit middleware |
| LLM06: Sensitive Information Disclosure | .architectai-ignore with default sensitive patterns | Blocks .env, keys, credentials from indexing |
| LLM09: Overreliance | Human review philosophy (Principle 6) | UI labels output as "draft", feedback mechanism |

### Deferred (Phase 2+)

| OWASP LLM Risk | Why Deferred |
|----------------|-------------|
| LLM03: Training Data Poisoning | Not applicable — we don't fine-tune |
| LLM05: Supply Chain | Monitor dependencies via Dependabot (CI) |
| LLM07: Excessive Agency | System has no tool-use capabilities |
| LLM08: Excessive Functionality | Single-purpose generation only |
| LLM10: Model Theft | No custom models to steal |

## Consequences

### Positive
- Known attack vectors addressed proportionately
- Output validation prevents malformed data propagation
- Sensitive files never reach LLM context
- Rate limiting prevents accidental cost explosion with cloud providers

### Negative
- Delimiter-based injection protection is not foolproof
- Rate limiting may frustrate power users (configurable via env)

## Review Trigger

Re-evaluate when:
- Multi-user deployment (attackers ≠ victims)
- System generates executable code
- External/untrusted data sources are indexed
- Enterprise compliance requires certified protection
