# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.5.0] - 2026-08-13

### Added

- Agent system: 7 typed agents (Requirements, Architecture, Security, Cloud/Cost, DevSecOps, QA, Synthesis)
- AgentRunner with RAG, context window fitting, validation retry, transient retry, timeout, telemetry
- Orchestrator with sequential + parallel execution, safe-stop, workflow state machine
- API routes: POST/GET /api/agent-workflows, GET /api/agents
- Frontend Workflow page with real-time status tracking
- Workflow rate limiting (5/min per IP)
- 7 agent prompts + 7 Zod output schemas
- OWASP LLM Top 10 security review
- 5 ADRs documenting agent system design decisions
- 82 new tests (241 total)
- Groq LLM provider (OpenAI-compatible API, fast inference, free tier)
- Google Gemini LLM + embedding provider (native REST API, free tier)
- ADR-0022: Multi-provider LLM expansion decision record

### Changed

- Rate limiter extended with workflowLimiter
- API index mounts agent-workflows and agents routers

## [1.4.0] - 2026-08-11

### Added

- Production environment gate (mock provider rejection, JWT secret strength, DATABASE_URL sslmode warning)
- Path containment module (`resolveFsPath`/`resolveContainedPath`) with `ALLOWED_FS_ROOTS`
- Artifact IDOR fix via owner-scoped JOINs
- Export and index rate limiters (`RATE_LIMIT_EXPORT`, `RATE_LIMIT_INDEX`)
- Request correlation IDs (`X-Request-ID` header echo)
- Real `/api/health` probes (DB, LLM clients, storage, telemetry) with degraded/error states
- Graceful shutdown with configurable drain period (`GRACE_PERIOD_MS`)
- Docker HEALTHCHECK using `node -e "fetch(...)"` (no curl dependency)
- Dependabot configuration (root npm, frontend, GitHub Actions)

### Changed

- Bedrock embedding default changed to Titan v1 (1536 dims, matching `vector(1536)` column)

## [1.3.0] - 2026-08-08

### Added

- Bedrock LLM + embeddings provider support
- S3 artifact storage with server-side export endpoints
- CloudWatch telemetry sink (opt-in)
- Generation telemetry wired to all six endpoints
- Least-privilege IAM and cost-safety documentation (`docs/aws/*`)

## [1.2.0] - 2026-08-05

### Added

- Mermaid diagrams (Context, Container, Component, Data Flow) with SVG/PNG export
- Rich engineering package export (README, requirements, architecture, diagrams, risks, tasks, metadata)
- Risk assessment with severity tags

## [1.1.0] - 2026-08-01

### Added

- Repository review assistant: analyze existing codebases for architectural patterns, SOLID violations, coupling issues
- Architecture Health Report artifact

## [1.0.0] - 2026-07-28

### Added

- 6-stage generation pipeline: Vision → Requirements → Architecture → Diagrams → Tasks → Risks
- Specification generation with functional requirements and acceptance criteria
- Architecture design with components, layers, bounded contexts, SOLID compliance
- Task breakdown with complexity estimates and dependency DAGs
- Product Vision generation
- RAG-enhanced generation with pgvector
- Provider-agnostic LLM support (OpenRouter, OpenAI, Ollama, mock)
- JWT authentication
- Local-first, Docker Compose deployment
