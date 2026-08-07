# ArchitectAI

**Transform ideas into production-ready software architecture using AI.**

ArchitectAI is an AI Software Architect that generates complete engineering packages from natural language descriptions — specifications, architecture documents, and implementation task breakdowns.

**Local-first. Cloud-ready.**

## Features

- **Specification Generation** — Functional requirements, acceptance criteria, constraints
- **Architecture Design** — Components, layers, bounded contexts, SOLID compliance
- **Task Breakdown** — Implementation tasks with complexity estimates and dependency graphs
- **Export Package** — Download a complete engineering .zip (README, requirements, architecture, tasks, metadata)
- **Provider Agnostic** — Works with OpenRouter, OpenAI, or local Ollama
- **RAG-Enhanced** — Index your project files for context-aware generation

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
| `LLM_PROVIDER`       | No        | openrouter                  | openrouter, openai, ollama, mock |
| `LLM_API_KEY`        | For cloud | —                           | Provider API key                 |
| `LLM_MODEL`          | No        | anthropic/claude-3.5-sonnet | Model identifier                 |
| `LLM_CONTEXT_WINDOW` | No        | 128000                      | Context window size              |
| `EMBEDDING_PROVIDER` | No        | openai                      | openai, openrouter, ollama, mock |
| `EMBEDDING_API_KEY`  | For cloud | —                           | Embedding provider key           |
| `DATABASE_URL`       | Yes       | (set in compose)            | PostgreSQL connection            |

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
| `/api/specs`                  | POST       | Generate specification |
| `/api/architecture`           | POST       | Generate architecture  |
| `/api/tasks`                  | POST       | Generate tasks         |
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
