# ADR-0021: Limited Parallelism (Security ∥ Cloud/Cost Only)

## Status

Accepted

## Date

2026-08-13

## Context

The agent workflow has 7 agents in a dependency graph. Full parallel execution (running all independent agents concurrently) would minimize wall-clock time, but introduces:

- Race conditions in shared state (artifact writes, telemetry counters).
- Partial failure handling: if 3 of 5 parallel agents succeed and 2 fail, what happens to the workflow?
- Debugging difficulty: parallel execution traces are harder to follow than sequential ones.
- Cost spikes: multiple concurrent LLM calls increase API costs and may hit rate limits.

The actual dependency graph has only one natural parallelism point: after Architecture is produced, Security and Cloud/Cost analysis are independent (they both consume the architecture output but don't depend on each other). All other phases are strictly sequential.

## Decision

Implement limited parallelism with exactly one parallel fork:

1. **Sequential by default** — Vision → Requirements → Architecture → ... → Synthesis.
2. **One parallel fork** — after Architecture, Security and Cloud/Cost run concurrently.
3. **Barrier after parallel fork** — both must complete before DevSecOps begins. If one fails, the other is cancelled (fail-fast).
4. **No parallel writes** — parallel agents read shared artifacts but write to separate artifact types (security vs cloud-cost), so no write conflicts.
5. **Telemetry is thread-safe** — the telemetry collector uses async-safe counters, so parallel agents recording metrics don't corrupt state.

## Consequences

### Positive

- Simpler reasoning: only one parallel fork to manage, with a clear barrier.
- No race conditions: parallel agents write to separate artifact types.
- Partial failure is bounded: one failure cancels the other, and the workflow fails cleanly.
- Cost is predictable: at most 2 concurrent LLM calls during the parallel phase.

### Negative

- Underutilizes parallelism: QA and DevSecOps could theoretically run in parallel, but the added complexity is not justified at 7 agents.
- The fixed fork point means new parallel opportunities require code changes.

### Risks

- If a future agent needs to run in parallel with Security or Cloud/Cost, the single-fork model must be extended. The orchestrator's design makes this a deliberate change (add a new fork), not an accidental one.
- LLM rate limits could still be hit during the parallel phase. Mitigated by the runner's retry-with-backoff logic.
