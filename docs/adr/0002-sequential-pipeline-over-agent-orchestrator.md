# ADR-0002: Sequential Pipeline Over Agent Orchestrator

## Status

Accepted

## Date

2026-08-04

## Context

The requirements specify an Agent Orchestrator with a registry of specialized agents, capability-based routing, multi-agent collaboration chains, and conflict detection between agent scopes.

In the current system:

- There is exactly ONE LLM provider (Ollama)
- There are exactly THREE generation tasks (spec, architecture, tasks)
- Each "agent" is simply a different system prompt sent to the same model
- Execution is strictly sequential: spec → architecture → tasks

The question is whether to build the full Agent Orchestrator now or use a simpler pattern.

## Decision

We will implement a **sequential GenerationPipeline** — a class with explicit methods for each generation type that calls the LLM with different prompts in sequence. No registry, no routing, no capability scopes.

## Consequences

### Positive

- ~50 lines of code vs ~500+ for a full orchestrator with registry
- Explicit control flow — every step is visible in one file
- No dynamic routing decisions at runtime — the code shows exactly what happens
- Easy to test — mock the LLMClient, call the method, verify the result
- Easy to debug — step through with a debugger, no indirection

### Negative

- Adding a new generation type requires modifying the pipeline class (not just registering a new agent)
- Cannot dynamically route requests based on capability matching
- Cannot parallelize agent execution (all calls are sequential)

### When to Revisit

Evolve to an Agent Orchestrator (Phase 3) when:

- We have multiple LLM providers requiring routing decisions
- We need parallel agent execution for performance
- Users want to define and register custom agents
- The number of generation types exceeds 6-8 (method count becomes unwieldy)

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- A second LLM provider is integrated (routing decisions become necessary)
- Generation types exceed 6 methods in the pipeline class (becomes unwieldy)
- Users request custom agent/prompt registration at runtime
- Sequential execution becomes a measurable latency bottleneck (parallel agents would be faster)
- The pipeline needs conditional branching based on intermediate results (not just linear chaining)

## Alternatives Considered

**Full Agent Orchestrator:** Rejected for MVP. The registry + routing + conflict detection + retry + timeout per agent is ~10x more code for functionally identical behavior when you have one model and sequential execution.

**Pipeline as configuration:** Rejected. A YAML/JSON-defined pipeline adds a parsing layer and makes the system harder to debug. TypeScript code IS the configuration.
