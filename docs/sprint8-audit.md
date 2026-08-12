# Sprint 8 — AWS Operations, Security & Production Hardening: Repository Audit

**Branch audited:** `sprint-8/aws-hardening` (HEAD `7c08e65`, == `main`, == `v1.3.0`)
**Version audited:** v1.3.0 (AWS Foundation, merged)
**Date:** 2026-08-11
**Auditor note:** Read-only audit. No files modified other than this document. Every claim below cites a file path. `git status` clean; branch has no Sprint 8 commits yet. No Sprint 8 implementation plan exists in the repo — the 13-phase mapping (§10) is derived from this audit's findings.

---

## Repository overview

Local-first, cloud-ready AI engineering platform. Modular monolith (Express + TypeScript, pino JSON logs), React/Vite SPA, PostgreSQL + pgvector, provider-agnostic `LLMClient` interface (`src/llm/interface.ts`) with OpenRouter / OpenAI / Ollama / mock / Bedrock. 6-stage generation pipeline, RAG over pgvector, artifact export (client zip + server-side `DocumentStore`). Local mode runs in Docker Compose with zero AWS credentials; all AWS integrations are opt-in (ADR-0013, ADR-0015).

## Sprint 7 delivered

| Module | Status | File(s) |
|---|---|---|
| Bedrock provider (Claude Messages + Titan embed, credential-chain `isHealthy`) | ✅ | `src/llm/providers/bedrock.ts` |
| Factory wiring (both LLM + embedding) | ✅ | `src/llm/factory.ts:36-42, 77-83` |
| Config (zod) + `S3_BUCKET` superRefine | ✅ | `src/config/index.ts:6-8, 40-74` |
| DocumentStore (Local + S3) + factory | ✅ | `src/storage/{document-store,local-store,s3-store,factory}.ts` |
| Server-side export + routes | ✅ | `src/storage/export-service.ts`, `src/api/routes/export.ts` |
| Telemetry wiring (6 routes) + CloudWatch sink | ✅ | `src/api/routes/generation.ts:34-61, 140-148`, `src/telemetry/*` |
| Migration 008 (additive `provider` column) | ✅ | `src/db/migrations/008-telemetry-provider.sql` |
| Frontend actions | ✅ | `frontend/src/lib/api.ts:169-176`, `frontend/src/pages/Generate.tsx:241-251` |
| AWS docs + ADR-0015 + README/ROADMAP/changelog | ✅ | `docs/aws/*.md`, `docs/adr/0015-optional-aws-integrations.md` |
| Unit tests (12 new files, AWS SDK mocked) | ✅ | `tests/unit/{bedrock-provider,bedrock-factory,config-aws,document-store,s3-store,export-service,cloudwatch-sink,telemetry-record,generation-tracker}.test.ts` |

### Discrepancies vs `docs/sprint7-implementation-plan.md`

- **`isHealthy()` is cheaper than planned.** Plan §2.1 said "lightweight `ListFoundationModels` (or a 1-token invoke)"; implementation only resolves credentials via `client.config.credentials()` (`bedrock.ts:109-116`) — zero API calls. Docs updated to match (`docs/aws/architecture.md:42`). Good drift.
- **`tests/integration/aws/*.test.ts` never created.** Plan §3 promised real-AWS tests gated by `AWS_INTEGRATION_TESTS=1`. No `tests/integration/` directory exists. Gaps remain: CloudWatch metrics, S3 SSE/encryption, and export flow have **no** end-to-end (even gated) tests — only LocalStack manual verification noted in the summary.
- **Telemetry test naming.** Plan listed `tests/unit/telemetry.test.ts`; delivered as three files (`generation-tracker`, `telemetry-record`, `cloudwatch-sink`). Cosmetic.
- **Test count.** Summary claims "61 tests"; repo has **64 `it()` blocks** across 14 files. Minor drift (likely additions after the summary was written).

## Current state

**Works:** local mode (zero AWS), mock/openrouter/openai/ollama, RAG, 6-stage pipeline, export (local + S3, LocalStack-verified per `docs/sprint7-summary.md:59-65`), telemetry to Postgres + opt-in CloudWatch, migrations on boot, non-root Docker user, graceful SIGTERM.

**Incomplete / broken:**
1. **Bedrock RAG indexing is likely broken (dimension mismatch).** `indexed_chunks.embedding` is `vector(1536)` (`src/db/migrations/004-indexed-chunks.sql:6`) but `BedrockClient.embed()` sends only `{ inputText }` (`src/llm/providers/bedrock.ts:86-90`). Amazon Titan Embed Text V2's default output is **1024** dimensions and there is no `dimensions` parameter or config field anywhere (unlike OpenAI, which passes `embeddingDimensions`, `openai.ts:84-86`). Inserting a 1024-dim vector into a 1536 column fails; the indexer swallows per-chunk errors and logs a warning (`src/rag/indexer.ts:59-61`), so indexing "completes" with zero chunks silently.
2. **Docker `HEALTHCHECK` is broken.** It calls `curl` (`Dockerfile:38`), but `curl` is not installed in `node:20-slim` (removed from all `node:*slim` images since Jan 2020). The container will always report `unhealthy`. App still runs (compose has no `depends_on` on it) but this blocks ECS/load-balancer readiness.
3. **Health endpoint LLM check is a placeholder.** `components.llm = { status: 'healthy', message: 'Provider configured' }` (`src/api/routes/health.ts:18-19`) — never calls `isHealthy()`. Storage/telemetry not reported.

## AWS footprint

**Services actually used (all optional, opt-in):**
- **Amazon Bedrock** — `LLM_PROVIDER=bedrock` / `EMBEDDING_PROVIDER=bedrock` (`src/llm/factory.ts`).
- **Amazon S3** — `STORAGE_PROVIDER=s3` + `S3_BUCKET` (required by config `src/config/index.ts:66-74` and factory `src/storage/factory.ts:11-13`).
- **CloudWatch Metrics** — `CLOUDWATCH_ENABLED=true` (`src/telemetry/cloudwatch-sink.ts:22`).

**Services NOT used:** RDS, ECS/Fargate, ECR, ALB, Route 53, Secrets Manager, KMS, CloudWatch Logs via SDK, no IaC. Compose has zero AWS wiring (`docker-compose.yml`); Dockerfile has zero AWS wiring. **No resource is auto-created** — every integration talks to pre-existing resources (ADR-0015 §Decision, `docs/aws/architecture.md:118-126`). Verified: no `cloudformation`, `put-bucket`, or resource-creation code anywhere in `src/`.

## Security findings

| # | Issue | Severity | Location | Existing mitigation | Recommendation | Status |
|---|---|---|---|---|---|---|
| S1 | Arbitrary server-path read via `/api/review` | HIGH (prod) / LOW (local single-user) | `src/api/routes/review.ts:33`, `src/review/repository.ts:68-170` | JWT auth; local-first threat model (ADR-0014) | In deployment, restrict to allowlisted roots + `resolve` containment; disable in cloud mode | Open |
| S2 | Arbitrary server-path read + unbounded embedding volume via `/api/projects/:id/index` | HIGH (prod + cost) | `src/api/routes/projects.ts:76-100` | JWT auth | Path allowlist + per-project/index size caps + rate limit | Open |
| S3 | **Dependabot not configured** though ADR-0015/LLM05 claims "monitor via Dependabot" (now active for `@aws-sdk/*`) | MEDIUM | `.github/` contains only `ci.yml`; claim at `docs/adr/0015-optional-aws-integrations.md:41`, `docs/sprint7-summary.md:74` | None (claim only) | Add `.github/dependabot.yml`; pin AWS SDK minors | Open |
| S4 | IDOR on artifacts — no ownership check | MEDIUM (becomes HIGH at multi-user) | `src/api/routes/artifacts.ts:11`; `src/api/routes/generation.ts:180,250,383,389,454` | Single user (ADR-0014) | Scope `getArtifact` to `userId`; validate ownership in generation routes | Open |
| S5 | Raw provider error bodies leaked to clients | MEDIUM | `generation.ts:156,226,288,358,429,506`; `openai.ts:53`, `openrouter.ts:50` | `error-handler.ts` masks 500s but generation routes bypass it | Return generic message; log detail server-side | Open |
| S6 | Rate limiting is per-process in-memory; `/api/export` and `/api/review` only get general 100/min | MEDIUM (prod) | `src/api/middleware/rate-limiter.ts:4-18`; mounts at `src/api/index.ts:26-31` | 10/min generation limiter | Add `trust proxy`, shared store (Redis), limiter on export + index | Open |
| S7 | JWT: no algorithm pinning, no issuer/audience, 24h no refresh | LOW | `src/api/middleware/auth.ts:19`, `src/api/routes/auth.ts:36` | HS256 default, placeholder-secret check (`config/index.ts:20-23`) | Pin `algorithms: ['HS256']`; roadmap v2.1.0 | Open |
| S8 | Sensitive-file blocking missing in **review** path (present in RAG) | LOW | `src/review/repository.ts:7-21` vs `src/rag/file-parser.ts:15-29` | Review only sends key files (README/package.json/*.config.ts, ≤2000 chars, `review/pipeline.ts:178-200`) | Mirror DEFAULT_IGNORE_PATTERNS; drop `*.config.ts`/`.env` from key files | Open |
| S9 | Query snippet + filesystem paths logged to stdout → CloudWatch Logs | LOW | `src/rag/retriever.ts:56`, `review.ts:48` | No payload logging in metrics | Redact/trim; document log-retention | Open |
| S10 | Weak `.architectai-ignore` matching (`relativePath.includes`) | LOW | `src/rag/file-parser.ts:107`, `review/repository.ts:95` | Default sensitive patterns | Glob-aware matcher | Open |
| S11 | Local export dir `./data/storage` not gitignored | LOW | `.gitignore` (no `data/` entry) | Runs in Docker volume normally | Add `data/` to `.gitignore`/`.dockerignore` | Open |
| S12 | Sprint 2.5 mitigations intact? | ✅ verified | Delimiter isolation `spec-v1.md:23-24`; zod output validation `output-validator.ts`; `.architectai-ignore` defaults; rate limits; JWT | AWS additions did **not** weaken any (ADR-0015 §Re-evaluation; provider-agnostic prompts) | — | OK |

## Cost risks

| Service | Charge source | Free-tier note | Safeguard today | Gap |
|---|---|---|---|---|
| **Bedrock (generation)** | per 1K tokens, Claude | none guaranteed (doc warns: `docs/aws/cost-safety.md:5`) | `maxTokens` 4096, 10/min rate limit, retry ≤2 (`retry.ts:34-67`), `LLM_CONTEXT_WINDOW` budget | No in-app daily/monthly token cap; budgets are manual `aws budgets` (doc-only) |
| **Bedrock (embeddings)** | Titan per 1M tokens, **1 call per 512-token chunk while indexing** | very low (doc) | none | **Biggest quiet-bleed.** Indexing a large repo = thousands of Titan calls; `/index` is unrate-limited (S2). cost-safety.md only says "very low" — no per-repo sizing guidance; also currently wasted (see finding #1 — inserts fail) |
| **S3** | GB-month + PUT/GET | ~5GB tier (doc) | prefix-scoped IAM + SSE-S3 (`s3-store.ts:48`), zips only | Lifecycle/retention is **manual** (`cost-safety.md:66-79`); no in-code retention; daily-dated keys accumulate |
| **CloudWatch metrics** | `PutMetricData`, 10 metrics/gen | first 10k/mo (doc) | opt-in default OFF, fire-and-forget, low-cardinality dims (`cloudwatch-sink.ts:42-70`) | No cap on batches beyond app rate limit |
| **CloudWatch logs** | `awslogs` driver ingestion+storage | — | none (no code) | Retention manual (14d doc, `cost-safety.md:89`); unlimited default; verbose pino info logs (incl. S9) |

## Production readiness gaps

| Severity | Gap | Evidence |
|---|---|---|
| HIGH | Docker HEALTHCHECK fails (no `curl` in `node:20-slim`) → unhealthy container, blocks LB/ECS | `Dockerfile:38` |
| HIGH | Arbitrary-path endpoints (S1/S2) are a data-exfil + cost primitive in any networked deployment | `review.ts`, `projects.ts:76-100` |
| HIGH | Bedrock RAG indexing broken (dimension mismatch) | `004-indexed-chunks.sql:6`, `bedrock.ts:86-90` |
| MEDIUM | Health endpoint shallow (LLM placeholder) | `health.ts:18-19` |
| MEDIUM | SIGTERM: `server.close()` + `process.exit(0)` immediately — in-flight requests not awaited, no grace timeout | `src/index.ts:39-47` |
| MEDIUM | Env validation fails fast on schema/placeholders ✓, but no `NODE_ENV=production` gate (weak non-placeholder secrets pass; mock default accepted in prod) | `config/index.ts:20-23, 26` |
| MEDIUM | CORS hardcoded `http://localhost:3000`; no helmet/security headers | `src/api/index.ts:21` |
| MEDIUM | No request correlation IDs — module-level pino children only; a generation can't be traced across log lines | `src/logger.ts:15-17` |
| MEDIUM | Rate limiting in-memory per-process (no `trust proxy`, no shared store) | `rate-limiter.ts` |
| MEDIUM | DB connection: no SSL option, no timeouts, pool `max:10` fixed | `src/db/connection.ts:7-10` |
| LOW | No backup strategy documented; telemetry table grows unbounded (accepted in ADR-0012) | `005-telemetry.sql`, ADR-0012 |
| ✅ | **Runs WITHOUT Ollama** — optional compose profile, not required | `docker-compose.yml:32-43` |
| ✅ | Migrations run at boot before listen; `isHealthy()` log-only (doesn't gate); providers lazy-instantiated | `index.ts:14-36`, `generation.ts:63-71` |

## Database readiness

| Current | Managed-Postgres (RDS) requirement |
|---|---|
| `pgvector/pgvector:pg16` local container (`docker-compose.yml:17`) | pgvector is available on RDS Postgres — OK, but verify exact minor |
| Migrations 001-008, transactional, additive 008 ✓ | Same runner works (`src/db/migrate.ts`); needs migration permissions |
| `vector(1536)` + HNSW `vector_cosine_ops` (`004-indexed-chunks.sql:6,13-14`) | **Dimension contract is hard-coded 1536** — must match provider (see finding #1) |
| No SSL in connection string / client config | RDS requires SSL — add `sslmode` + rejectUnauthorized |
| Pool `max:10`, no `connectionTimeoutMillis`/`statement_timeout`/idle timeout | Tune for Fargate; add query timeout to bound cost/latency |
| No backups, no retention | RDS snapshots; telemetry retention policy needed |

## Observability

- CloudWatch sink captures **10 numeric metrics** per generation: `GenerationDuration, EmbeddingDuration, RetrievalDuration, TotalDuration, PromptTokens, CompletionTokens, TotalTokens, RetrievedChunks, FittedChunks, ContextWindowUsed`, dims `Module/Model/Provider/Status` (`src/telemetry/cloudwatch-sink.ts:49-69`). **No prompts/responses/keys in metrics** ✓.
- Logs: pino JSON to stdout (ADR-0012); shipped to CloudWatch Logs only via documented `awslogs` driver (`docs/aws/architecture.md:65-76`) — not present in compose.
- **No request/correlation IDs** (gap); query snippets and paths leak to logs (S9).

## Testing state

- **64 tests / 14 files**: 12 unit + 2 property (`tests/unit/*`, `tests/properties/*`). No test touches a real DB; AWS SDK fully mocked via `vi.mock` (`bedrock-provider.test.ts:8-14`, `s3-store.test.ts:5-12`, `cloudwatch-sink.test.ts:5-9`). CI runs lint/typecheck/test with `LLM_PROVIDER=mock`, `EMBEDDING_PROVIDER=mock` (`.github/workflows/ci.yml:44-49`).
- **No integration tests** — the gated `tests/integration/aws/*` from the plan were never written. AWS paths are verified only by LocalStack manual runs.
- **Coverage config** excludes migrations and barrel files (`vitest.config.ts:8-12`).

## Phase-by-phase recommendation for Sprint 8

1. **Fix Bedrock embeddings** — `src/llm/providers/bedrock.ts` `embed()`: add `dimensions` to Titan request; add `BEDROCK_EMBEDDING_DIMENSIONS` to `src/config/index.ts` (default 1024 or 1536) and pass through `factory.ts`; test with a mocked 1024-dim vector; keep `vector(1536)` aligned.
2. **Fix Docker HEALTHCHECK** — replace `curl` with `node -e "fetch('http://localhost:3001/api/health').then(...)"` or add `apt-get install curl` in runner stage; verify compose reports healthy.
3. **Real readiness endpoint** — `src/api/routes/health.ts`: call `llm.isHealthy()` lazily, add storage + telemetry probes, keep boot non-gating.
4. **Production env validation** — `src/config/index.ts`: `NODE_ENV=production` gate (reject weak JWT_SECRET, reject `mock` defaults, warn on no SSL).
5. **Graceful shutdown** — `src/index.ts`: await `server.close()` with grace timeout before exit; log drained requests.
6. **Request correlation** — request-scoped pino child with `requestId` (logger middleware in `src/api/index.ts`).
7. **Rate limiting productionization** — `trust proxy`, configurable keyGenerator, optional Redis store, add generation limiter to `/api/export/:projectId` and `/api/projects/:id/index`.
8. **Path containment + review sensitive-file defaults** — mirror RAG `DEFAULT_IGNORE_PATTERNS` into `src/review/repository.ts`; resolve+contain the `path` arg in both review and index routes.
9. **Fix IDOR** — ownership-scoped `getArtifact` in `artifact-repo.ts` + all generation route call sites.
10. **Dependency security** — add `.github/dependabot.yml`; document pinning policy for `@aws-sdk/*`.
11. **Error + log hygiene** — generic client messages on 500s (generation routes), strip query snippet from `retriever.ts:56` logs, reduce provider log level.
12. **Cost controls** — in-app per-day token + export counters; S3 lifecycle + CloudWatch log-retention steps moved into repeatable IaC/scripts; update `docs/aws/cost-safety.md` with embedding-index sizing.
13. **DB + integration hardening** — RDS SSL/tuning guidance in `docs/aws/architecture.md`, backup note, and (optional) restore `tests/integration/aws/*` gated by `AWS_INTEGRATION_TESTS`, wired into a LocalStack CI job.

## Verdict

**Ready for AWS *integrations* as opt-in — NOT ready for production AWS *deployment*.**

The Sprint 7 surface (Bedrock/S3/CloudWatch as env-gated add-ons) is clean, well-documented, cost-aware, and testable without an AWS account. The local-first default and ADR-0014 mitigations survived intact. But before any ECS/ALB/Fargate deployment: the broken Docker HEALTHCHECK, the shallow health endpoint, the Titan-dimension bug (which silently disables Bedrock RAG indexing), the arbitrary-path endpoints, and per-process rate limiting must be fixed. Treat Sprint 8's 13 phases above as the deployment prerequisite, not optional polish. Do **not** enable CloudWatch/`awslogs` or point at a real bucket without first creating the budgets + lifecycle + retention from `docs/aws/cost-safety.md`.
