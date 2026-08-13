# ADR-0018: Lightweight Orchestrator (Not Temporal/Cadence/Prefect)

## Status

Accepted

## Date

2026-08-13

## Context

The agent system needs a workflow orchestration layer to coordinate 7 agents through a multi-phase execution graph. Options considered:

1. **Full workflow engine** (Temporal, Cadence, Prefect) — durable execution, retry semantics, visual dashboards, but adds significant infrastructure (Temporal server, worker processes, persistence layer) and operational complexity.
2. **Custom code** — a purpose-built `Orchestrator` class with a fixed execution graph, in-process state machine, and built-in safe-stop.

The project targets a single-instance deployment (ADR-0013, ADR-0016) with a known, fixed workflow (the 6-phase generation pipeline). There is no need for long-running workflows, human approval gates, or cross-service orchestration.

## Decision

Implement a custom `Orchestrator` class with:

1. **Fixed 6-phase execution graph**: Vision → Requirements → Architecture → [Security ∥ Cloud/Cost] → DevSecOps → QA → Synthesis.
2. **In-process state machine** — workflow state transitions are tracked in memory (and optionally persisted to the database for resume).
3. **Safe-stop support** — the orchestrator checks a `stopRequested` flag between phases and after each agent completes, allowing graceful cancellation.
4. **No external dependencies** — the orchestrator runs as part of the Express.js process. No separate worker, no message queue, no external persistence.
5. **Sequential by default** — only Security and Cloud/Cost run in parallel (after Architecture). All other phases are sequential.

## Consequences

### Positive

- Zero infrastructure overhead — no Temporal server, no worker processes, no additional databases.
- Simple mental model — the workflow is a known sequence, easy to reason about and debug.
- Safe-stop and timeout are trivial to implement in-process.
- The fixed graph matches the actual product workflow perfectly.

### Negative

- Limited to known workflow patterns — adding a new parallel phase or conditional branching requires code changes.
- No durable execution — if the process crashes mid-workflow, the workflow must restart from the last persisted checkpoint.
- No built-in visualization of running workflows (mitigated by the frontend status tracking).

### Risks

- If the product evolves to require human-in-the-loop approval, long-running workflows, or cross-service orchestration, the custom orchestrator will need to be replaced. The fixed graph design makes this a deliberate migration point, not an accidental one.
