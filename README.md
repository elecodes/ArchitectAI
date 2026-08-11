# ArchitectAI

**Transform ideas into production-ready software architecture using AI.**

ArchitectAI is an AI Software Architect that generates complete engineering packages from natural language descriptions — specifications, architecture documents, and implementation task breakdowns.

**Local-first. Cloud-ready.**

## Current Status

**Version: 1.3.0** — AWS Foundation.

ArchitectAI can today:

- Accept a natural language description of a software project
- Run a 6-stage generation pipeline: Product Vision → Requirements → Architecture → Diagrams → Tasks → Risk Assessment
- Generate structured requirements, architecture documents, and implementation task breakdowns with dependency DAGs
- Render C4-style Mermaid diagrams (component, container, data flow, context) with SVG/PNG export
- Export a complete engineering package as a .zip file (client-side) or to a configured storage provider (local filesystem or S3)
- Work with OpenRouter, OpenAI, Ollama, Bedrock, or a mock provider
- Record generation telemetry (Postgres, optionally mirrored to CloudWatch)
- Run locally with Docker Compose (no cloud dependency, no GPU required)

See [ROADMAP.md](ROADMAP.md) for planned features.

## Features

- **Specification Generation** — Functional requirements, acceptance criteria, constraints
- **Architecture Design** — Components, layers, bounded contexts, SOLID compliance
- **Task Breakdown** — Implementation tasks with complexity estimates and dependency graphs
- **Product Vision** — Vision statement, problem, target users, business goals, success metrics
- **Risk Assessment** — Categorized, severity-tagged risks with mitigations
- **Mermaid Diagrams** — Component, container, data flow, and context diagrams with SVG/PNG export
- **Export Package** — Client-side .zip download or store on local filesystem / S3
- **Provider Agnostic** — OpenRouter, OpenAI, Ollama, AWS Bedrock, or mock
- **RAG-Enhanced** — Index your project files for context-aware generation
- **Telemetry** — Per-generation metrics to Postgres, optionally mirrored to CloudWatch

## Optional AWS Mode

All AWS integrations are **opt-in and off by default** — the default local run needs no AWS account. See the AWS docs for configuration, least-privilege IAM, and cost safety:

- [`docs/aws/architecture.md`](docs/aws/architecture.md) — local vs AWS mode, env reference
- [`docs/aws/iam.md`](docs/aws/iam.md) — least-privilege IAM policy
- [`docs/aws/cost-safety.md`](docs/aws/cost-safety.md) — budgets, cleanup, verification

## Quick Start

```bash
# Clone
git clone git@github.com:elecodes/ArchitectAI.git
cd ArchitectAI

# Configure
cp .env.example .env
# Edit .env:
#   JWT_SECRET=your-secret-here
#   LLM_PROVIDER=mock (or openrouter/openai with API key)
#   EMBEDDING_PROVIDER=mock

# Start
docker compose up -d --build

# Open
open http://localhost:3001
```

Default login: `admin` / `architect`

## Configuration

| Variable             | Required  | Default                     | Description                      |
| -------------------- | --------- | --------------------------- | -------------------------------- |
| `JWT_SECRET`         | Yes       | —                           | JWT signing secret               |
| `LLM_PROVIDER`       | No        | openrouter                  | openrouter, openai, ollama, mock, bedrock |
| `LLM_API_KEY`        | For cloud | —                           | Provider API key                 |
| `LLM_MODEL`          | No        | anthropic/claude-3.5-sonnet | Model identifier                 |
| `LLM_CONTEXT_WINDOW` | No        | 128000                      | Context window size              |
| `EMBEDDING_PROVIDER` | No        | openai                      | openai, openrouter, ollama, mock, bedrock |
| `EMBEDDING_API_KEY`  | For cloud | —                           | Embedding provider key           |
| `DATABASE_URL`       | Yes       | (set in compose)            | PostgreSQL connection            |
| `STORAGE_PROVIDER`   | No        | local                       | local, s3                        |
| `CLOUDWATCH_ENABLED` | No        | false                       | Mirror telemetry to CloudWatch   |

See `.env.example` for the full set (Bedrock models/region, S3 bucket/prefix, CloudWatch region/namespace). AWS credentials are never configured here — they come from the AWS SDK default credential provider chain.

## LLM Providers

### OpenRouter (recommended)

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=anthropic/claude-3.5-sonnet
```

### OpenAI

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

### AWS Bedrock (optional)

```env
LLM_PROVIDER=bedrock
EMBEDDING_PROVIDER=bedrock

BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20240620-v1:0
BEDROCK_REGION=us-east-1
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1
```

Credentials resolve through the AWS SDK default provider chain (IAM role, env, or shared config) — see `docs/aws/iam.md`.

### Ollama (local, optional)

```bash
docker compose --profile local-llm up -d
```

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
LLM_CONTEXT_WINDOW=8192
```

### Mock (development/testing)

```env
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

## Architecture

```
┌─────────────────────────────────┐
│         React Frontend          │
│  (Login → Dashboard → Generate) │
└──────────────┬──────────────────┘
               │ HTTP
┌──────────────▼──────────────────┐
│       Express.js Backend        │
│                                 │
│  ┌─────────┐  ┌──────────────┐ │
│  │  Auth   │  │  Generation  │ │
│  │  (JWT)  │  │  Pipeline    │ │
│  └─────────┘  └──────┬───────┘ │
│                       │         │
│  ┌────────┐  ┌───────▼───────┐ │
│  │  RAG   │  │  LLM Client  │ │
│  │(pgvec) │  │  (interface)  │ │
│  └────┬───┘  └───────┬───────┘ │
└───────┼───────────────┼─────────┘
        │               │
┌───────▼───┐  ┌────────▼────────┐
│PostgreSQL │  │ OpenRouter/OpenAI│
│+ pgvector │  │ / Ollama / Mock  │
└───────────┘  └─────────────────┘
```

## Development

```bash
# Backend (hot reload)
npm run dev

# Frontend (Vite dev server with proxy)
cd frontend && npm run dev

# Tests
npm test

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

## Project Structure

```
src/                    # Backend
├── api/               # Express routes + middleware
├── config/            # Environment config (zod validated)
├── db/                # PostgreSQL connection + migrations
├── generation/        # AI pipeline (spec, arch, tasks)
├── llm/               # Provider interface + implementations
├── prompts/           # Versioned prompt files
├── rag/               # File indexing + vector retrieval
└── telemetry/         # Generation metrics

frontend/              # React SPA
├── src/pages/         # Login, Dashboard, NewProject, Generate
├── src/components/    # Design system: Wordmark, Kicker, Button, Sheet, TopBar, Field, icons
└── src/lib/           # API client
```

## API Endpoints

| Endpoint                      | Method     | Description            |
| ----------------------------- | ---------- | ---------------------- |
| `/api/health`                 | GET        | Health check           |
| `/api/auth/login`             | POST       | Get JWT token          |
| `/api/projects`               | POST/GET   | Create/list projects   |
| `/api/projects/:id`           | GET/DELETE | Get/delete project     |
| `/api/projects/:id/index`     | POST       | Index files for RAG    |
| `/api/vision`                 | POST       | Generate product vision |
| `/api/specs`                  | POST       | Generate specification |
| `/api/architecture`           | POST       | Generate architecture  |
| `/api/tasks`                  | POST       | Generate tasks         |
| `/api/risks`                  | POST       | Generate risk assessment |
| `/api/diagrams`               | POST       | Generate Mermaid diagrams |
| `/api/export/:projectId`      | POST       | Assemble + store engineering package |
| `/api/export/:projectId/latest` | GET      | Download stored package |
| `/api/artifacts/:id`          | GET        | Get artifact           |
| `/api/artifacts/:id/feedback` | POST       | Submit feedback        |

## Engineering Principles

1. Simplicity before abstraction
2. AI output is never trusted without validation
3. Local-first, cloud-ready
4. Provider-agnostic AI
5. Small incremental deliveries

See `docs/adr/` for Architecture Decision Records.

## License

Private
