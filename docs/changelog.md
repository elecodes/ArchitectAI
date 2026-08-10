# Changelog

All notable changes to ArchitectAI are documented here.

---

## v1.3.0 — AWS Foundation (2026-08-10)

### New Features

- **AWS Bedrock LLM Provider** — Generate and embed via Amazon Bedrock (`LLM_PROVIDER=bedrock`, `EMBEDDING_PROVIDER=bedrock`) with Claude Messages API and Amazon Titan embeddings; credentials resolved via the SDK default provider chain
- **S3 Artifact Storage** — Optional artifact persistence (`STORAGE_PROVIDER=s3`) with SSE-S3 encryption and configurable key prefix; local filesystem storage remains the default
- **Server-Side Export Package** — `POST/GET /api/export/:projectId` assembles and stores the engineering package on the configured provider; "Save to storage" / "Download stored" actions on the Generate page
- **CloudWatch Telemetry** — Optional `PutMetricData` sink (`CLOUDWATCH_ENABLED=true`, off by default) with 10 metrics per generation and Module/Model/Provider/Status dimensions
- **Generation Telemetry Wiring** — All six generation endpoints now record success/failure telemetry via `GenerationTracker` (previously dead code); new `provider` column (migration 008) for cost attribution

### Configuration

- `BEDROCK_MODEL`, `BEDROCK_REGION`, `BEDROCK_TIMEOUT_MS`, `BEDROCK_EMBEDDING_MODEL`
- `STORAGE_PROVIDER`, `STORAGE_LOCAL_DIR`, `S3_BUCKET` (required when `STORAGE_PROVIDER=s3`), `S3_REGION`, `S3_PREFIX`
- `CLOUDWATCH_ENABLED`, `CLOUDWATCH_REGION`, `CLOUDWATCH_METRICS_NAMESPACE`

### Documentation

- `docs/aws/architecture.md` — local vs AWS mode, env reference, out-of-scope list
- `docs/aws/iam.md` — least-privilege IAM policy for Bedrock/S3/CloudWatch
- `docs/aws/cost-safety.md` — budgets, lifecycle rules, cleanup, verification checklist
- `docs/adr/0015-optional-aws-integrations.md` — AWS integrations are optional; re-evaluates ADR-0014 deferred OWASP items

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
