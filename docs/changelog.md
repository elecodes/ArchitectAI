# Changelog

All notable changes to ArchitectAI are documented here.

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
