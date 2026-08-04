# ADR-0009: PostgreSQL + pgvector for RAG Retrieval

## Status

Accepted

## Date

2026-08-04

## Context

ArchitectAI needs vector similarity search for RAG (Retrieval-Augmented Generation). When a user generates an artifact, the system retrieves semantically relevant chunks from the user's indexed project files and includes them as context in the LLM prompt.

Vector store options considered:

1. **PostgreSQL + pgvector** — vector extension for existing database
2. **Pinecone** — managed cloud vector database
3. **Chromadb** — lightweight embedded vector store
4. **Weaviate** — self-hosted vector database
5. **Qdrant** — high-performance vector database

Constraints:

- Must run locally with no cloud dependency
- Must handle up to 500 files (estimated ~2,500 chunks at 512 tokens each)
- Must integrate with existing PostgreSQL (already needed for relational data)
- Minimal operational overhead (single engineer maintaining the system)

## Decision

We will use **PostgreSQL with the pgvector extension** for all vector storage and similarity search.

- Embedding dimension: 768 (nomic-embed-text)
- Index type: HNSW (Hierarchical Navigable Small World)
- Distance metric: cosine similarity
- Index parameters: `m = 16, ef_construction = 64`

## Consequences

### Positive

- **One database for everything.** Relational data (users, projects, artifacts) AND vector data in the same PostgreSQL instance. No additional service to deploy, monitor, or back up.
- **Transactional consistency.** Can update vectors and metadata in the same transaction.
- **Mature ecosystem.** PostgreSQL tooling, monitoring, backup strategies all apply.
- **Sufficient scale.** HNSW index handles 2,500 vectors with sub-10ms query time. pgvector scales to millions with proper tuning.
- **Docker image exists.** `pgvector/pgvector:pg16` is production-ready.

### Negative

- pgvector is less optimized than purpose-built vector databases for very large datasets (>10M vectors)
- HNSW index rebuild is expensive if embeddings change frequently (not an issue for MVP — re-index is manual)
- No built-in hybrid search (vector + keyword) — would need to implement manually if needed

### Index Configuration Rationale

- **HNSW over IVFFlat:** HNSW has better recall at the same query speed for datasets under 1M vectors. IVFFlat requires tuning `nlist` and `nprobe` parameters.
- **m = 16:** Controls the number of connections per node. 16 is the standard recommendation for datasets under 100K vectors. Higher values improve recall but increase index size.
- **ef_construction = 64:** Controls build-time accuracy. 64 is sufficient for our scale. Increasing to 200 would improve recall by ~1% but 4x the build time.
- **Cosine similarity:** Standard for text embeddings. All modern embedding models are trained with cosine similarity as the distance metric.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- Vector count exceeds 100K and query latency exceeds 50ms (pgvector may need replacement with purpose-built vector DB)
- A use case requires real-time indexing of file changes with <1s latency (pgvector HNSW rebuild may be too slow)
- Hybrid search (vector + keyword/BM25) becomes critical and pg_search extension is insufficient
- Multi-tenancy at scale requires vector isolation beyond WHERE clause filtering

## Alternatives Considered

**Chromadb:** Rejected. Adds another service to Docker Compose. Embedded mode ties to Python. Less mature than PostgreSQL for production use.

**Pinecone:** Rejected. Cloud-only. Contradicts local-first requirement.

**Qdrant:** Viable alternative. Rejected for MVP because it adds a fourth Docker container. The performance advantage over pgvector is irrelevant at 2,500 vectors. Reconsider if scaling to >100K vectors (Phase 5+).

**SQLite + sqlite-vss:** Rejected. Lacks concurrent access support. PostgreSQL already needed for relational data.
