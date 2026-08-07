# Changelog

A chronological log of significant engineering decisions and changes made during the ArchitectAI project. For full context and rationale, see the corresponding ADR in `docs/adr/`.

---

## 2026-08-07

- Redesigned the UI with a "Technical Blueprint" aesthetic (branch `ui/polish`): paper grid background, hairline sheets with registration marks, Instrument Sans + IBM Plex Mono, single warm clay accent (renamed token `blueprint` → `accent` so the hue is swappable). Introduced a shared design system in `frontend/src/components/` (Wordmark, Kicker, Button, Sheet, TopBar, Field, icons). Explicitly avoids common AI-UI clichés (gradients, glassmorphism, glow).

## 2026-08-04

- Adopted modular monolith architecture over microservices. (ADR-0001)
- Replaced Agent Orchestrator with sequential GenerationPipeline. (ADR-0002)
- Introduced minimal LLMClient interface for provider agnosticism and testability. (ADR-0003)
- Introduced Context Window Manager to prevent silent token overflow. (ADR-0004)
- Added LLM output validation with bounded retry (max 1). (ADR-0005)
- Adopted file-based prompt versioning with artifact provenance tracking. (ADR-0006)
- Replaced Self-Review quality scoring with optional Structural Validator. (ADR-0007)
- Selected PostgreSQL + pgvector over dedicated vector databases. (ADR-0009)
- Chose fixed-size chunking (512 tokens) for MVP RAG. (ADR-0010)
- Implemented prompt injection protection via context delimiters. (ADR-0011)
- Chose AI-focused telemetry over general application observability. (ADR-0012)
- Switched from Ollama-only to provider-agnostic LLM architecture. Local-first. Cloud-ready. (ADR-0013, supersedes ADR-0008)
