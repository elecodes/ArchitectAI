# ADR-0006: Prompt Versioning and Artifact Provenance

## Status

Accepted

## Date

2026-08-04

## Context

In an AI-powered system, prompts define product behavior. A prompt change can dramatically alter output quality — for better or worse. Without versioning:

- You cannot reproduce a previous result
- You cannot diagnose why output quality changed
- You cannot A/B test prompt improvements
- You cannot roll back a bad prompt change
- You cannot correlate quality signals (feedback, retry rates) with specific prompt versions

The Engineering Constitution (Principle 3) states: "Prompt files are source code."

## Decision

We will implement **file-based prompt versioning** with **artifact provenance tracking**:

**Prompt files:**

- Stored in `src/prompts/` as markdown files
- Named with version suffix: `spec-v1.md`, `architecture-v1.md`, `tasks-v1.md`
- Loaded at application startup, cached in memory
- Token count pre-calculated at load time (for Context Window Manager)

**Provenance on every artifact:**
Every generated artifact persists:

- `model`: which LLM model produced it (e.g., "llama3.1:8b")
- `prompt_version`: which prompt file was used (e.g., "spec-v1")
- `generated_at`: exact timestamp of generation
- `context_window_used`: tokens consumed
- `rag_chunks_used`: how many context chunks were included
- `retry_count`: 0 or 1

## Consequences

### Positive

- Full reproducibility: given the same input + model + prompt version + RAG context, the output should be similar
- Debugging: when quality drops, check if a prompt was recently changed
- Evaluation: correlate user feedback (thumbs-up/down) with prompt versions
- Safe rollback: revert to previous prompt file if new version degrades quality
- Audit trail: every artifact shows exactly how it was produced

### Negative

- Prompt files must be maintained outside of code (not inline in generators)
- Version bumping requires discipline — engineers must remember to increment
- Token pre-calculation adds startup time (~milliseconds, negligible)

### Versioning Rules

1. Any change to a prompt file requires a version bump (v1 → v2)
2. Old versions are NEVER deleted — they stay in the codebase for reference
3. The active version is configured per prompt type (could be different per prompt)
4. Provenance references the version string, not file content hash (readable > cryptographic)

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- Prompt versions exceed v10 for any single prompt (consider archiving old versions or switching to date-based versioning)
- Multiple prompts need coordinated version bumps (consider a manifest file that pins all prompt versions together)
- Non-engineer team members need to edit prompts (consider a simple UI or database-stored prompts with approval workflow)
- A/B testing requires concurrent active versions for the same prompt type (need routing logic)

## Alternatives Considered

**Inline prompts in code:** Rejected. Violates Principle 3. Cannot track which prompt produced which artifact without reading git blame.

**Content-hash-based versioning:** Rejected. A SHA-256 hash is not human-readable. "spec-v1" is immediately meaningful in logs and debugging. Content hashes are useful for deduplication, not for human communication.

**Database-stored prompts:** Rejected. Adds complexity (CRUD for prompts, UI for editing). Prompts should go through the same review process as code — git is the right tool.

**No provenance — just version prompts:** Rejected. Versioning without provenance means you know prompts changed but can't correlate changes with output quality. Both are needed.
