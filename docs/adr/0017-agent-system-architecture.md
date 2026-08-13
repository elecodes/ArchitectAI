# ADR-0017: Agent System Architecture — Why Agents Now

## Status

Accepted

## Date

2026-08-13

## Context

v1.4 used a monolithic pipeline where `SpecGenerator`, `ArchitectureGenerator`, and `RiskGenerator` each bundled prompt, schema, and execution logic into a single class. There was no reusable agent abstraction: each generator was tightly coupled to its own prompt template, Zod output schema, and LLM invocation. Adding a new capability (e.g. Cloud/Cost estimation, DevSecOps hardening) meant copying one of the existing generators and mutating it — violating DRY and making it impossible to apply consistent validation, retry, or telemetry across all generation phases.

The monolithic design also prevented parallel execution. Security and Cloud/Cost analysis are independent after architecture is produced, but the sequential pipeline forced them to wait for each other. There was no mechanism to express agent dependencies or capability boundaries.

## Decision

Introduce a lightweight `AgentDefinition` + `AgentRunner` abstraction:

1. **7 typed agents**, each with an explicit Zod `inputSchema` and `outputSchema`: Requirements, Architecture, Security, Cloud/Cost, DevSecOps, QA, Synthesis.
2. **Fixed dependency graph** — not a generic DAG engine. The orchestrator knows the execution order (Architecture → Security ∥ Cloud/Cost → DevSecOps → QA → Synthesis) and enforces it at the workflow level.
3. **Capability whitelist per agent** — each agent declares exactly which RAG sources and artifact types it may read/write. The runner enforces this before execution (ADR-0020).
4. **AgentRunner** provides shared infrastructure: RAG retrieval, context window fitting, Zod validation with retry, transient LLM error retry, timeout, and telemetry — applied uniformly to all agents.

## Consequences

### Positive

- New agents (e.g. Compliance, Performance) can be added by declaring a schema + prompt + capability set, with zero runner changes.
- Parallel execution is possible for independent phases (Security ∥ Cloud/Cost), reducing wall-clock time.
- Capability-based security model (OWASP LLM06) is enforced at the runner level, not ad-hoc per generator.
- Uniform validation, retry, and telemetry across all agents.

### Negative

- More abstraction layers than the monolithic generators — added complexity for small-scale workflows.
- Fixed dependency graph means new inter-agent dependencies require code changes (acceptable at 7 agents; would need re-evaluation at 20+).

### Risks

- The capability model assumes all agents are honest about their declared needs. A compromised agent could request broad capabilities. Mitigated by the principle of least privilege: each agent gets only what it needs, and capabilities are reviewed during agent addition.
