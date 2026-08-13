# ADR-0020: Capability-Based Tool Access (Not Role-Based)

## Status

Accepted

## Date

2026-08-13

## Context

OWASP LLM Top 10 — LLM06 (Excessive Agency) states that LLM-based systems should limit the actions each agent can perform. The previous monolithic pipeline had no permission model: every generator could read any RAG source, write any artifact type, and invoke any LLM operation. This is acceptable when there is one "agent" (the pipeline itself), but breaks down when multiple agents with different responsibilities coexist.

Role-based access control (RBAC) was considered but is a poor fit: agents don't have "roles" in the human-user sense. An agent's permissions should be derived from what it needs to do, not from a role hierarchy.

## Decision

Implement fine-grained capability-based access control for agents:

1. **Capabilities are strings** with a hierarchical format: `domain:action[:target]`. Examples:
   - `rag:read` — read from the RAG index
   - `artifact:write:security` — write security-type artifacts
   - `artifact:read:architecture` — read architecture artifacts
   - `telemetry:write` — record telemetry events
2. **Each agent declares an exact capability set** — no more, no less. The runner enforces this at execution time.
3. **No shell, no filesystem, no HTTP beyond LLM calls** — agents operate purely through the runner's provided context (RAG results, previous phase outputs) and output (structured schemas).
4. **Capability checks are deny-by-default** — if a capability is not in the agent's whitelist, the runner throws `CapabilityError` before any LLM call is made.

## Consequences

### Positive

- Fine-grained security: a compromised Security agent cannot write architecture artifacts; a compromised Cloud/Cost agent cannot read RAG sources.
- OWASP LLM06 compliance: each agent's blast radius is limited to its declared capabilities.
- Capabilities are inspectable and auditable — the agent registry is a single source of truth for what each agent can do.

### Negative

- Capabilities must be maintained as agents evolve. Adding a new capability (e.g. `diagram:write`) requires updating the agent's definition and the runner's capability check.
- The capability model is coarse-grained at the domain level (e.g. `artifact:write:*` is all-or-nothing per type). Finer granularity (per-field write) is not supported.

### Risks

- Capability sprawl: as the number of agents grows, the capability set may become unwieldy. Mitigated by keeping capabilities hierarchical and reviewing them during agent addition.
- The capability model does not cover LLM-level restrictions (e.g. preventing an agent from generating harmful content). That is addressed by the LLM provider's safety filters, not the capability system.
