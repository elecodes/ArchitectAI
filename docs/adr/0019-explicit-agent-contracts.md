# ADR-0019: Explicit Agent Contracts (Zod Schemas + Capabilities)

## Status

Accepted

## Date

2026-08-13

## Context

Agents produce structured output (architecture specs, security reviews, cost estimates) that downstream agents and the final engineering package consume. Without explicit contracts:

- Agent output shape is implicit — a schema change in one agent silently breaks downstream consumers.
- No machine-enforceable boundary on what an agent can read or write.
- Validation is ad-hoc (per-generator try/catch with manual error messages).

The OWASP LLM Top 10 (specifically LLM06: Excessive Agency) requires that LLM-based systems limit what each agent can do. Without an explicit permission model, agents have implicit access to everything the application can access.

## Decision

Every agent declares an explicit contract via `AgentDefinition`:

1. **Zod `inputSchema`** — validates what the agent receives. The runner rejects malformed inputs before the LLM call.
2. **Zod `outputSchema`** — validates what the agent produces. The runner retries on validation failure (up to a configurable limit) before failing the phase.
3. **Capability whitelist** — an array of capabilities the agent needs (e.g. `rag:read`, `artifact:write:security`). The runner checks capabilities before execution and throws `CapabilityError` if an undeclared capability is requested.
4. **Prompt template** — versioned, immutable per agent version. The runner passes the prompt + validated input to the LLM.

The `AgentRunner` enforces the contract: validate input → check capabilities → call LLM → validate output → return typed result.

## Consequences

### Positive

- Type safety end-to-end: input and output are Zod-validated, so TypeScript types are derived from schemas.
- Capability model provides OWASP LLM06 mitigation: agents cannot access resources they haven't declared.
- Schema changes are caught at validation time, not at runtime downstream.
- Consistent retry and error reporting across all agents.

### Negative

- More boilerplate per agent: each new agent requires an input schema, output schema, capability list, and prompt.
- Zod schemas must be kept in sync with the actual prompt instructions — a schema that doesn't match the prompt's expected output will cause validation failures.

### Risks

- Schema drift: if a prompt is updated without updating the output schema, the agent may produce valid natural language that fails Zod validation. Mitigated by prompt versioning (ADR-0006) and schema-as-source-of-truth.
