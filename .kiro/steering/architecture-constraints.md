# ArchitectAI — Architecture Constraints

This document defines the boundaries and constraints that govern all implementation decisions. The architecture is frozen as of 2026-08-04.

---

## Local-First. Cloud-Ready.

- The application always runs locally during development
- Docker Compose is the standard development environment
- PostgreSQL + pgvector runs locally
- The backend and frontend run locally
- The LLM provider is configurable and pluggable
- Local inference (Ollama) is supported but OPTIONAL
- Cloud LLM providers are first-class citizens
- No GPU is required to use the system

## Provider-Agnostic AI

The application depends only on the `LLMClient` interface:

```typescript
interface LLMClient {
  complete(request): Promise<CompletionResponse>;
  embed(text): Promise<EmbeddingResponse>;
  isHealthy(): Promise<boolean>;
}
```

Supported providers for MVP:

- OpenRouter (default)
- OpenAI
- Ollama (optional, for offline use)
- Mock (testing)

No provider-specific logic leaks into business code. The application must never know which provider is being used.

Embeddings are independently configurable from the generation provider.

## Technology Stack

| Layer      | Technology                             | Rationale                          |
| ---------- | -------------------------------------- | ---------------------------------- |
| Backend    | Node.js + Express + TypeScript         | Mature, typed, fast development    |
| Frontend   | React + Vite + TypeScript              | Standard SPA, minimal complexity   |
| Database   | PostgreSQL + pgvector                  | Relational + vector in one service |
| LLM        | Provider-agnostic (OpenRouter default) | No hardware constraints            |
| Deployment | Docker Compose (local)                 | Two containers: app + database     |
| Testing    | Vitest + fast-check                    | Unit + property-based              |

## Architecture Style

- Modular monolith (single Express.js process)
- Sequential generation pipeline (no agent orchestrator)
- Repository pattern for data access
- Provider factory for LLM instantiation
- No microservices, no event sourcing, no CQRS

## What Is NOT in the MVP

- AWS deployment (Phase 2)
- Streaming responses
- Multi-agent orchestration
- Diagram generation
- Feedback learning loops
- Multi-user / RBAC
- Real-time collaboration

## Scope Boundaries

Phase 1 (MVP):

- Local execution with Docker
- Provider-agnostic LLM
- RAG with pgvector
- Specification generation
- Architecture document generation
- Task breakdown generation
- Structural validation (optional)
- Prompt versioning with provenance
- AI observability (telemetry)
- User feedback (thumbs signal)

Phase 2 (AWS):

- ECS / Fargate deployment
- Bedrock integration
- S3 document storage
- CloudWatch monitoring
- Secrets Manager
- IAM roles
- CI/CD pipeline

AWS is a deployment target for Phase 2. It must NOT appear in MVP implementation.
