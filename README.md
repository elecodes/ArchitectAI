# ArchitectAI

An AI Software Architect that transforms ideas into production-ready engineering packages.

**Local-first. Cloud-ready.**

## What It Does

ArchitectAI generates structured architecture artifacts from natural language descriptions:

- Software specifications with acceptance criteria
- Architecture documents following Clean Architecture and DDD
- Task breakdowns with dependency graphs and complexity estimates

The output resembles what an experienced software architect would deliver before a team writes code.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- [Node.js](https://nodejs.org/) >= 20
- An API key for your chosen LLM provider (OpenRouter, OpenAI, or local Ollama)

## Quick Start

```bash
# 1. Clone
git clone git@github.com:elecodes/ArchitectAI.git
cd ArchitectAI

# 2. Configure
cp .env.example .env
# Edit .env — set JWT_SECRET and LLM_API_KEY at minimum

# 3. Start (app + PostgreSQL)
docker compose up -d

# 4. Verify
curl http://localhost:3001/api/health

# 5. Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "architect"}'
```

## Configuration

All configuration is via environment variables. See `.env.example` for the full list.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Server port |
| `NODE_ENV` | No | development | Environment |
| `LOG_LEVEL` | No | info | Log verbosity (debug, info, warn, error) |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `JWT_SECRET` | Yes | — | Secret for JWT signing (must not be a placeholder) |
| `LLM_PROVIDER` | No | openrouter | LLM provider: openrouter, openai, ollama, mock |
| `LLM_API_KEY` | For cloud | — | API key for the LLM provider |
| `LLM_MODEL` | No | anthropic/claude-3.5-sonnet | Model identifier |
| `LLM_CONTEXT_WINDOW` | No | 128000 | Model context window (tokens) |
| `EMBEDDING_PROVIDER` | No | openai | Embedding provider: openai, openrouter, ollama, mock |
| `EMBEDDING_API_KEY` | For cloud | — | API key for embeddings |
| `EMBEDDING_MODEL` | No | text-embedding-3-small | Embedding model |
| `EMBEDDING_DIMENSIONS` | No | 1536 | Embedding vector dimensions |
| `OLLAMA_URL` | If using Ollama | http://localhost:11434 | Ollama server URL |

## LLM Providers

### OpenRouter (recommended)

Best balance of model variety, cost, and quality. Access Claude, GPT-4, Llama, and more through one API.

```env
LLM_PROVIDER=openrouter
LLM_API_KEY=sk-or-v1-...
LLM_MODEL=anthropic/claude-3.5-sonnet
```

Get a key at [openrouter.ai](https://openrouter.ai/).

### OpenAI

Direct OpenAI access.

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

### Ollama (local, optional)

No internet required. Requires GPU or patience.

```bash
# Start with Ollama profile
docker compose --profile local-llm up -d

# Pull a model
docker compose exec ollama ollama pull llama3.1:8b
```

```env
LLM_PROVIDER=ollama
LLM_MODEL=llama3.1:8b
LLM_CONTEXT_WINDOW=8192
OLLAMA_URL=http://ollama:11434
```

### Mock (testing)

Deterministic responses for development and testing. No API key needed.

```env
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

## Development

```bash
# Install dependencies
npm install

# Run in development (hot reload)
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

Requires a running PostgreSQL instance. Use Docker Compose or a local installation.

## Architecture

- **Monolithic Express.js backend** — one process, simple to debug and deploy
- **Provider-agnostic LLM** — swap providers via configuration, no code changes
- **PostgreSQL + pgvector** — relational data and vector search in one database
- **Sequential generation pipeline** — spec → architecture → tasks
- **Versioned prompts** — prompts are source code, tracked with provenance

See `docs/adr/` for architectural decisions and their rationale.

## Project Structure

```
src/
├── api/          # Express routes and middleware
├── config/       # Environment configuration with validation
├── db/           # Database connection, migrations, repositories
├── generation/   # Generation pipeline and artifact generators
├── llm/          # LLM provider interface, factory, and implementations
├── prompts/      # Versioned prompt files (.md) and loader
├── rag/          # RAG indexing and retrieval
├── telemetry/    # AI generation observability
├── logger.ts     # Structured JSON logging
└── index.ts      # Application entry point
```

## Default Credentials

For local development only:

- **Username:** admin
- **Password:** architect

Change these immediately in any non-local deployment.

## License

Private — not open source.
