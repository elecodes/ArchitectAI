# ADR-0007: Structural Validator Replaces Self-Review Quality Scoring

## Status

Accepted (supersedes original Self-Review Engine design)

## Date

2026-08-04

## Context

The original requirements specified a Self-Review Engine that:

- Scores every artifact 0-100 on five dimensions (correctness, completeness, consistency, testability, security)
- Runs automatically after every generation
- Blocks delivery if score < 70
- Detects cross-artifact inconsistencies

The architecture review challenged this design:

1. **Same model scoring its own output is epistemologically weak.** A 7B model cannot reliably detect its own hallucinations or logical errors. It's asking a student to grade their own exam.
2. **Doubles latency for every operation.** 30s generation + 30s review = 60s minimum per artifact.
3. **Quality judgment requires domain expertise.** A local model cannot meaningfully assess whether an architecture follows Clean Architecture principles — that's the human architect's job.
4. **Blocking on quality score violates Principle 6** (Human judgment always overrides AI).

## Decision

We will replace the Self-Review Engine with a **Structural Validator** that:

1. Is **optional** and **user-triggered** (not automatic)
2. Checks **format**, not **quality**:
   - JSON validity
   - Required fields present
   - No empty sections
   - Mermaid syntax validity (if applicable)
   - Broken internal references
3. Uses programmatic checks FIRST (no LLM for basic field validation)
4. Uses a single LLM call only for content-structure analysis (markdown correctness, section completeness)

The Structural Validator is exposed via `POST /api/artifacts/:id/validate` — users opt in.

## Consequences

### Positive

- No latency penalty on the happy path (validation is optional)
- Honest about what AI can and cannot do (format checking: yes, quality judgment: no)
- Reduces LLM costs by 50% (no mandatory second call per generation)
- User maintains control — Principle 6 respected
- Programmatic checks are deterministic and fast (no model dependency for basic field checking)

### Negative

- Users don't get automatic quality feedback (tradeoff: faster delivery vs proactive warnings)
- No 0-100 quality score (cannot do trend analysis on quality over time)
- Users may ship structurally valid but architecturally poor artifacts (this was always true — the model scoring itself didn't prevent this)

### What Replaces Quality Judgment?

- **User feedback (thumbs-up/down):** Real humans evaluating real output. Ground truth.
- **Retry rates from telemetry:** High retry rates indicate prompt problems.
- **Structural validation pass rates:** If 30% of artifacts fail structural checks, the generation prompt needs improvement.

These signals are more reliable than a 7B model's self-assessment.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- A cloud LLM (GPT-4, Claude) becomes available via Phase 5 adapter — a larger model CAN meaningfully judge architecture quality
- User feedback data shows strong correlation between structural validation results and user thumbs-down (validator is catching real issues)
- Users consistently request automatic quality warnings before reviewing artifacts
- Evaluation dataset (Phase 4) enables measuring whether LLM quality scoring adds real value vs noise

## Alternatives Considered

**Keep Self-Review but make it optional:** Partially adopted. The structural validator IS the reduced version of self-review. We kept the useful part (format checking) and removed the unreliable part (quality scoring).

**Use a larger model for review:** Not feasible for local inference (16GB RAM). A 70B model for review would consume all available resources. Possible with cloud providers or in Phase 2 with Bedrock.

**Remove all automated checking:** Rejected. Structural validation (missing fields, empty sections) IS reliably detectable and prevents a class of display/parsing errors downstream.
