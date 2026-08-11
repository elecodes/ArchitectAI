# Changelog

All notable changes to ArchitectAI are documented here.

---

## v1.4.0 — Security & Production Hardening (2026-08-11)

### New Features

- **Production Health Probes** — `/api/health` now performs real checks (DB `SELECT 1`, generation + embedding `isHealthy`, storage `listObjects`, telemetry status) with 2s timeouts, aggregating to ok/degraded/error with HTTP 200/503 and never throwing
- **Graceful Shutdown** — SIGTERM/SIGINT drain in-flight requests via `server.close()` within `GRACE_PERIOD_MS` (default 10000) before force-exiting
- **Request Correlation IDs** — sanitized `X-Request-ID` in/out with a per-request child logger and a PII-free access log (method/path/status/duration only)
- **Titan v1 Embedding Default Fix** — Bedrock embedding defaults to `amazon.titan-embed-text-v1` (native 1536 dims, matching `vector(1536)`); the `dimensions` parameter is sent only for v2 models, which are schema-constrained to 256/512/1024
- **Docker HEALTHCHECK Fix** — probe rewritten with `node -e "fetch(...)"` because `node:20-slim` ships no `curl`; `--start-period=40s` added
- **Dependabot** — `.github/dependabot.yml` covers root npm, the `frontend/` npm workspace, and GitHub Actions, all weekly

### Configuration

- `TRUST_PROXY`, `ALLOWED_FS_ROOTS`, `MAX_INDEX_FILES`, `GRACE_PERIOD_MS`, `BEDROCK_EMBEDDING_DIMENSIONS`, `RATE_LIMIT_EXPORT`, `RATE_LIMIT_INDEX`

### Documentation

- `docs/adr/0016-security-production-hardening.md` — Sprint 8 hardening decisions
- `docs/security/sprint8-review.md` — consolidated security review (audit findings S1–S12, production-readiness gaps, residual risks, release checklist)
- `docs/sprint8-audit.md` — phase-0 audit of security and database-readiness gaps
- `docs/aws/secrets.md`, `docs/aws/networking.md`, `docs/aws/observability.md`, `docs/aws/cost-control.md`, `docs/aws/database-readiness.md` — new AWS ops docs; `docs/aws/iam.md` and `docs/aws/architecture.md` updated

### Security

- **Production environment gate** — `NODE_ENV=production` refuses to boot with mock LLM/embedding providers, rejects `JWT_SECRET` shorter than 32 characters or in the known-weak set, and warns when `DATABASE_URL` omits `sslmode`
- **Path containment** — review and index routes resolve paths through `ALLOWED_FS_ROOTS` (failing closed to `process.cwd()` in production); escapes return `400 PATH_NOT_ALLOWED` (closes audit findings S1/S2)
- **Artifact IDOR fix** — `getArtifact`/`listArtifacts` scope queries through the owning project; non-owned artifacts return 404, including before feedback upsert (closes S4)
- **Dedicated export/index rate limits** — `exportLimiter` (10/min, `RATE_LIMIT_EXPORT`) and `indexLimiter` (5/min, `RATE_LIMIT_INDEX`); `MAX_INDEX_FILES` default 500 bounds embedding volume (mitigates S6)
- **Error and log hygiene** — provider detail logged server-side only, generic client errors, query snippets truncated and whitespace-normalized, PII-free access log (closes S5/S9)
- Rate limiting stays in-memory per-process — accepted residual risk for single-instance deployments (sprint8-review.md R1); Redis documented as the multi-instance remediation

---

## v1.3.0 — AWS Foundation (2026-08-10)

### New Features

- **AWS Bedrock LLM Provider** — Generate and embed via Amazon Bedrock (`LLM_PROVIDER=bedrock`, `EMBEDDING_PROVIDER=bedrock`) with Claude Messages API and Amazon Titan embeddings; credentials resolved via the SDK default provider chain
- **S3 Artifact Storage** — Optional artifact persistence (`STORAGE_PROVIDER=s3`) with SSE-S3 encryption and configurable key prefix; local filesystem storage remains the default
- **S3-Compatible Endpoint Support** — optional `S3_FORCE_PATH_STYLE` for LocalStack/MinIO; full S3 + CloudWatch flows verified end-to-end against LocalStack 4.13.1
- **Server-Side Export Package** — `POST/GET /api/export/:projectId` assembles and stores the engineering package on the configured provider; "Save to storage" / "Download stored" actions on the Generate page
- **CloudWatch Telemetry** — Optional `PutMetricData` sink (`CLOUDWATCH_ENABLED=true`, off by default) with 10 metrics per generation and Module/Model/Provider/Status dimensions
- **Generation Telemetry Wiring** — All six generation endpoints now record success/failure telemetry via `GenerationTracker` (previously dead code); new `provider` column (migration 008) for cost attribution

### Configuration

- `BEDROCK_MODEL`, `BEDROCK_REGION`, `BEDROCK_TIMEOUT_MS`, `BEDROCK_EMBEDDING_MODEL`
- `STORAGE_PROVIDER`, `STORAGE_LOCAL_DIR`, `S3_BUCKET` (required when `STORAGE_PROVIDER=s3`), `S3_REGION`, `S3_PREFIX`, `S3_FORCE_PATH_STYLE`
- `CLOUDWATCH_ENABLED`, `CLOUDWATCH_REGION`, `CLOUDWATCH_METRICS_NAMESPACE`

### Documentation

- `docs/aws/architecture.md` — local vs AWS mode, env reference, out-of-scope list
- `docs/aws/iam.md` — least-privilege IAM policy for Bedrock/S3/CloudWatch
- `docs/aws/cost-safety.md` — budgets, lifecycle rules, cleanup, verification checklist
- `docs/adr/0015-optional-aws-integrations.md` — AWS integrations are optional; re-evaluates ADR-0014 deferred OWASP items
- `docs/aws/architecture.md` — LocalStack section: test S3 + CloudWatch locally with no AWS account or spend

### Security

- All AWS integrations are opt-in; default local run has zero AWS presence
- No credentials in config — SDK default provider chain only; no access keys committed
- CloudWatch sink is fire-and-forget and dynamically imported (no SDK init when disabled)

---

## v1.2.0 — Architecture Visualization (2026-08-08)

### New Features

- **6-Stage Generation Pipeline** — Vision → Requirements → Architecture → Diagrams → Tasks → Risks with real-time stage tracking
- **Product Vision** — AI-generated vision statement, problem, target users, business goals, and success metrics
- **Risk Assessment** — Categorized, severity-tagged risks (critical/high/medium/low) with mitigation strategies
- **Mermaid Architecture Diagrams** — Component, Container, Data Flow, and System Context diagrams rendered from generated source
- **Per-Diagram Export** — Download any diagram as SVG or PNG directly from the viewer
- **Diagram Zoom** — Zoom in/out with reset and percentage indicator; source/diagram toggle per diagram
- **Rich Engineering Package** — Export .zip now includes rendered PNG and SVG for each diagram alongside `.mmd` sources
- **Design System Restyle** — Vision, risks, and diagram views updated to the blueprint visual language (hairline sheets, mono labels, clay accent)

### API

- `POST /api/generate/vision` — Product vision generation
- `POST /api/generate/risks` — Risk assessment generation
- `POST /api/generate/diagrams` — Mermaid diagram generation (component, container, data flow, context)

---

## v1.1.0 — Repository Review (2026-08-08)

### New Features

- **Repository Import** — Point to a local folder and import all source files with configurable ignore rules
- **Technology Detection** — Static analysis detects language, framework, package manager, database, ORM, testing, Docker, CI/CD, monorepo
- **AI Engineering Review** — 11-dimension quality scoring (1-10) covering code quality, architecture, SOLID, security, maintainability, scalability, readability, documentation, testing
- **Improvement Suggestions** — Prioritized recommendations (critical/high/medium/low) with effort estimates
- **Project Summary** — AI-generated overview of architecture, patterns, problems, technical debt, entry points
- **Review UI** — New `/review` page with tabbed results viewer (Stack, Summary, Review, Improvements)
- **Score Visualizations** — Color-coded progress bars for each quality dimension

### API

- `POST /api/review` — Accepts `{ path, customIgnore? }`, returns full engineering review package

### New Prompts

- `review-summary-v1.md` — Project understanding and architecture overview
- `review-engineering-v1.md` — Formal engineering review (11 dimensions)
- `review-improvements-v1.md` — Prioritized recommendations

### Security

- Repository analysis is purely static — never executes code, never installs dependencies

---

## v1.0.0 — First Stable Release (2026-08-07)

### Major Features

- **Specification Generation** — Transform natural language descriptions into structured requirements with functional requirements, acceptance criteria, constraints, and dependencies
- **Architecture Generation** — Produce Clean Architecture documents with components, bounded contexts, dependency graphs, and SOLID compliance notes
- **Task Breakdown** — Generate implementation task lists with complexity estimates, acceptance criteria, and dependency ordering (validated DAG)
- **RAG-Enhanced Generation** — Index project files for context-aware output using pgvector semantic search
- **Provider-Agnostic LLM** — Support for OpenRouter, OpenAI, Ollama, and Mock providers via a single interface
- **Engineering Package Export** — Download complete .zip with README, Requirements, Architecture, Tasks, and Metadata
- **Pipeline Progress UI** — Real-time stage tracking (Requirements → Architecture → Tasks)
- **Feedback System** — Thumbs up/down on generated artifacts for quality signal collection

### Architecture

- Modular monolith (Express.js + TypeScript)
- Sequential generation pipeline (no agent orchestrator)
- LLMClient interface with 4 provider implementations
- Context Window Manager (progressive RAG truncation)
- Output Validator with bounded retry (max 1 retry on invalid JSON)
- Versioned prompts with artifact provenance tracking
- PostgreSQL + pgvector for relational data and vector search
- Docker Compose (app + database, optional Ollama)

### Security (OWASP LLM Top 10)

- Prompt injection protection via delimiter isolation
- Rate limiting (100 req/min general, 10 req/min generation)
- .architectai-ignore with default sensitive file patterns
- Output schema validation on all LLM responses
- JWT authentication with 24h expiry (no default secrets)
- Input size validation

### Testing

- Property-based tests (fast-check): context window budget, chunker round-trip
- Unit tests: output validator, retry logic, spec generator
- CI pipeline (GitHub Actions): lint, typecheck, test

### Current Limitations

- Single-user system (no multi-user, no RBAC)
- Mock provider returns static responses (real provider needs API key)
- No streaming responses (request/response only)
- No diagram generation
- No feedback learning loop (feedback stored but not used for improvement)
- Token estimation uses chars/4 heuristic (not a proper tokenizer)
- No AWS deployment (local Docker only)

### Known Issues

- Vite HMR cache may require `rm -rf node_modules/.vite` after certain changes
- Font size changes require full Vite restart to reflect in browser
