# Sprint 7 — AWS Foundation & Cloud AI: Implementation Plan

Status: **Phase 0 review — pending approval before implementation**
Branch: `sprint-7/aws-foundation`
Target version: **v1.3.0**

---

## 0. Executive Summary

ArchitectAI is a local-first modular monolith (Express + TypeScript, PostgreSQL + pgvector, React/Vite frontend). Sprint 7 introduces **optional** AWS capabilities without changing the local-first architecture:

1. **AWS Bedrock** as an optional LLM provider (sits beside mock / openai / openrouter / ollama)
2. **Amazon S3** as an optional artifact/document storage implementation (beside local filesystem)
3. **CloudWatch** as an optional metrics emitter reusing the existing telemetry pipeline
4. **IAM least-privilege documentation**
5. **Cost-safety documentation** (critical — the developer previously incurred accidental AWS charges)

Every AWS feature is off by default. Local mode (Docker + mock + Postgres) is untouched and remains the default. **No production infrastructure is created automatically.**

Key Phase 0 findings that shape the plan:

- The `LLMClient` interface (`complete` / `embed` / `isHealthy`) is the documented seam for a Bedrock provider (ADR-0003, ADR-0013). Generators are fully provider-agnostic.
- Config is a single zod schema in `src/config/index.ts` with an enum whitelist that fails fast at boot. Bedrock registers cleanly there.
- Artifacts are stored **only** in Postgres JSONB (no filesystem storage exists today). The engineering-package `.zip` is built **100% client-side** in React. S3 therefore needs a real backend consumer: a server-side export endpoint backed by a `DocumentStore` abstraction (Local fs / S3).
- `GenerationTracker` and the `generation_telemetry` table exist but are **dead code — never wired into any route**. CloudWatch work must first wire the existing telemetry pipeline, then attach an optional CloudWatch sink.
- The project has a mature ADR governance process. Sprint 7 should add **ADR-0015** (AWS optional integrations) and trigger the review of ADR-0014 (OWASP review condition on multi-user/deployment).
- Tests use Vitest + MockLLMClient injection; no test touches a real DB. AWS integrations must be testable without an AWS account (the normal suite) — real-resource tests are gated and disabled by default.

---

## 1. Current Architecture (Phase 0 review findings)

### 1.1 Boot sequence (`src/index.ts`)

1. Load config → 2. run DB migrations → 3. load prompts → 4. `createLLMClient(config)` + `llm.isHealthy()` (log-only, does not gate startup) → 5. HTTP server (`createApp()` in `src/api/index.ts`).

### 1.2 LLM provider architecture

- Interface `src/llm/interface.ts`:
  - `complete(request: CompletionRequest): Promise<CompletionResponse>` (`{ content, durationMs, tokenCount: { prompt, completion } }`)
  - `embed(text): Promise<EmbeddingResponse>` (`{ embedding: number[], durationMs }`)
  - `isHealthy(): Promise<boolean>`
- Providers in `src/llm/providers/`: `mock.ts`, `openai.ts`, `openrouter.ts`. **No `ollama.ts`** — Ollama reuses `OpenAIClient` pointed at the Ollama OpenAI-compatible endpoint.
- Factory `src/llm/factory.ts`: `createLLMClient(config)` switches on `config.llmProvider` (`'mock' | 'openai' | 'openrouter' | 'ollama'`); throws on unknown provider. `createEmbeddingClient(config)` is a **separate** switch on `config.embeddingProvider`.
- Providers are created lazily per route (no DI container). Generators receive `llm: LLMClient` via constructor and are **100% provider-agnostic** — no generator changes needed for Bedrock.
- Token counts: real `usage` when present, else `ceil(charLen/4)` heuristic fallback (all three providers).
- No streaming anywhere; the 3-method interface is stable (ADR-0003 defers streaming).

### 1.3 Configuration & environment handling (`src/config/index.ts`)

- Single zod schema, `dotenv.config()` at module top, module-level frozen singleton `config`.
- `LLM_PROVIDERS = ['openrouter','openai','ollama','mock']` (zod enum), default `'openrouter'`. Invalid value → hard boot failure.
- `EMBEDDING_PROVIDERS = ['openai','openrouter','ollama','mock']`, default `'openai'`.
- Provider-specific startup validation is minimal: only API-key presence, checked in the factory (not config).
- `.env` maps 1:1 to config fields; docker-compose passes `env_file: .env` plus a `DATABASE_URL` override for container networking.

### 1.4 Storage / artifact architecture

- **DB-only.** `src/db/repositories/artifact-repo.ts` (`createArtifact` / `getArtifact` / `listArtifacts`) persists artifact JSONB into the `artifacts` table (migration `003-artifacts.sql`). Six write sites, all in `src/api/routes/generation.ts`.
- No filesystem storage of generated output; no binary/upload concept (no multer, no blobs).
- **Engineering-package `.zip` is built in the browser** (`frontend/src/pages/Generate.tsx` `handleExport()`, using `jszip`) from in-memory React state. The backend has **no zip/export route** and no zip dependency.
- RAG/review read user source files from disk as **input only** (`src/rag/file-parser.ts`, `src/review/repository.ts`).
- Consequence: "S3 storage" needs a genuinely new backend capability. The repository pattern is the documented seam (design doc + ADR), but the honest minimal scope is a **DocumentStore abstraction** with a server-side export consumer (see §2.2).

### 1.5 Telemetry / observability

- `src/telemetry/generation-tracker.ts` defines `GenerationRecord` (19 fields: durations, tokens, RAG metrics, context utilization, status, retry count, error category) and `GenerationTracker.record()` → INSERT into `generation_telemetry` (migration `005-telemetry.sql`).
- **Critical: `GenerationTracker` is never instantiated or called anywhere.** The table stays empty. This is greenfield wiring.
- Every field needed to build a `GenerationRecord` is already computed in-memory at the route level (from `retriever.ts`, `context-window.ts`, `retry.ts` results) — it just is never assembled and persisted.
- Logger is pino, structured JSON to stdout (`src/logger.ts`), `{ module }` child loggers, no transports. ADR-0012 intentionally chose stdout JSON for aggregation flexibility.
- Health route (`src/api/routes/health.ts`) reports a hardcoded `llm: healthy` placeholder; real health is only logged at boot.

### 1.6 Tests & CI

- Vitest 2.1.8 + fast-check (property tests). Config includes `tests/**/*.test.ts` + `tests/**/*.property.ts`, node env, coverage on `src/**/*.ts`.
- Established pattern: inject `MockLLMClient` with `completionResponses`, assert via `getCalls()` / `getCallCount()`.
- No tests touch a real DB. CI (`.github/workflows/ci.yml`) runs lint / typecheck / test with `LLM_PROVIDER=mock`, `EMBEDDING_PROVIDER=mock`.

### 1.7 Documentation & ADRs

- `docs/adr/` — 14 ADRs (README index, Nygard format). Relevant: 0003 (LLMClient seam), 0012 (telemetry), 0013 (local-first provider-agnostic), 0014 (OWASP LLM Top 10; review trigger = multi-user deployment).
- `ROADMAP.md` (repo root) — v2.0.0 "AWS Deployment" lists Bedrock, S3, CloudWatch, IAM, ECS/Fargate, RDS, etc. **Out of Sprint 7 scope** (§2.4).
- `.kiro/steering/architecture-constraints.md` — "AWS is a Phase 2 target; MUST NOT appear in MVP implementation." Sprint 7 is the start of Phase 2, scoped to **optional** integrations.
- Changelog: v1.0.0 → v1.2.0 (latest = Sprint 6 Architecture Visualization). Versioning policy: every sprint bumps minor → **Sprint 7 = v1.3.0**.
- Drift to fix: root `package.json` version `0.1.0` (stale), `README.md` "Version 1.0.0" (stale), ROADMAP v1.2.0/v1.3.0 entries partially delivered by Sprint 6.

### 1.8 Sprint 6 recap (v1.2.0)

- 6-stage pipeline, but `GenerationPipeline` only orchestrates spec → arch → tasks; vision/risks/diagrams run as separate ad-hoc routes. The **frontend** orchestrates all 6 stages sequentially.
- Generators in `src/generation/`: `spec-generator.ts`, `arch-generator.ts`, `task-generator.ts`, `vision-generator.ts`, `risk-generator.ts`. `src/diagrams/mermaid.ts` is deterministic (no LLM).
- Routes in `src/api/routes/generation.ts`: `/specs`, `/architecture`, `/tasks`, `/vision`, `/risks`, `/diagrams` (all `authMiddleware`). Migration `007` added artifact types `product_vision`, `risk_assessment`, `diagrams`.
- Frontend: `frontend/src/pages/Generate.tsx` (6-stage runPipeline + tabs + `.zip`), `MermaidDiagram.tsx`, `frontend/src/lib/mermaid.ts` (SVG/PNG export), `frontend/src/lib/api.ts`.

### 1.9 Key gaps found in review

1. No AWS SDK / AWS config anywhere. Net-new.
2. `GenerationTracker` is dead code — telemetry must be wired before CloudWatch.
3. No backend export path — S3 storage needs a new consumer to be real.
4. No Bedrock; `LLMClient` interface is the clean seam.
5. Version drift in package.json / README / ROADMAP.

---

## 2. Proposed AWS Additions

### 2.1 AWS Bedrock as optional LLM provider

**Concept (matches existing architecture):**

```
LLM Provider
├── Mock
├── OpenAI
├── OpenRouter
├── Ollama (optional local)
└── AWS Bedrock (optional)   ← NEW
```

**Approach — mirror `openai.ts` exactly:**

- New file `src/llm/providers/bedrock.ts`:
  - `interface BedrockConfig { model: string; region: string; timeoutMs?: number; embeddingModel?: string }`
  - `class BedrockClient implements LLMClient`
    - `complete()` → use `@aws-sdk/client-bedrock-runtime` `InvokeModelCommand` with the Anthropic Claude Messages body shape (`anthropic_version: "bedrock-2023-05-01"`, `max_tokens`, `temperature`, `messages`). Return `{ content, durationMs, tokenCount: { prompt, completion } }` (parse real usage where available, else the `ceil(charLen/4)` fallback to match siblings).
    - `embed()` → Amazon Titan embedding model via the runtime (`amazon.titan-embed-text-v2` by default, configurable).
    - `isHealthy()` → lightweight `ListFoundationModels` (or a 1-token invoke) with short timeout; catch → `false` (same contract as siblings).
  - Credentials: **never hardcoded.** Rely on the AWS SDK **default credential provider chain** (env → shared config → ECS/EC2/IMDS roles). Region from config with a sane default.
- Export from `src/llm/providers/index.ts`.
- `src/llm/factory.ts`: add `case 'bedrock':` to `createLLMClient` (and `createEmbeddingClient` if Bedrock embeddings are in scope — see §11 decision D2).
- `src/config/index.ts`: add `'bedrock'` to `LLM_PROVIDERS` enum; add Bedrock env fields (§4).
- **Do NOT make Bedrock the default.** Local mode stays on `mock`/`openai`/`ollama`.

**Bedrock-specific validation at startup:** model must be non-empty; region defaults; credentials are NOT validated at boot (they come from the chain and are lazily resolved) — but `isHealthy()` at boot already reports (log-only) if the chain fails. This preserves the existing "health check does not gate startup" behavior.

### 2.2 Amazon S3 as optional artifact/document storage

**Concept:**

```
Artifact Storage
├── Local filesystem   (default, NEW)
└── S3                 (optional, NEW)
```

**Approach — new `DocumentStore` abstraction with a real consumer:**

- New module `src/storage/`:
  - `document-store.ts` — `interface DocumentStore { putObject(key, data, contentType); getObject(key); deleteObject(key); listObjects(prefix) }`
  - `local-store.ts` — `LocalDocumentStore` writes to `STORAGE_LOCAL_DIR` (default `./data/storage`). This is the new **local filesystem** default implementation.
  - `s3-store.ts` — `S3DocumentStore` uses `@aws-sdk/client-s3` (PutObject/GetObject/DeleteObject/ListObjectsV2), region + bucket + optional prefix from config, default credential chain, SSE-S3 default.
  - `factory.ts` — `createDocumentStore(config)` switches on `STORAGE_PROVIDER` (`'local' | 's3'`), throws on unknown.
- **Consumer = new server-side engineering-package export endpoint** (this gives S3 a genuine purpose and keeps Postgres as source of truth):
  - `POST /api/export/:projectId` — assembles the engineering package server-side (README + artifacts + diagrams `.mmd`/`.svg`/`.png`) into a `.zip` (add `jszip` to backend deps), stores it via `DocumentStore` (local dir or S3), returns `{ storageProvider, key, sizeBytes }`.
  - `GET /api/export/:projectId/latest` — downloads the stored package (works for both local and S3 transparently).
  - The existing client-side zip in `Generate.tsx` is kept as the local convenience path; the frontend gains an optional "Export to storage" action backed by the new endpoint.
- Postgres `artifacts` table remains the source of truth and is **unchanged** — no schema migration required.
- **Do NOT replace local storage**; `STORAGE_PROVIDER=local` is the default and requires zero AWS config.

### 2.3 CloudWatch observability (minimal)

**Approach — wire the existing pipeline, then attach an optional sink:**

1. **Wire `GenerationTracker`** (prerequisite, no AWS involved): in `src/api/routes/generation.ts`, after each of the six generation results (and in the error paths), assemble a `GenerationRecord` from in-memory data (durations, `tokenCount`, RAG `retriever.ts` result, `context-window.ts` budget, status, retry count, error category) and call `tracker.record(...)`. Fire-and-forget (record already swallows errors).
   - Add a `provider` field to `GenerationRecord` + a `provider` column via migration `008-telemetry-provider.sql` (additive `ALTER TABLE ... ADD COLUMN`). This is the one small schema addition.
2. **Optional CloudWatch sink**: `src/telemetry/cloudwatch-sink.ts` — when `CLOUDWATCH_ENABLED=true`, after the DB insert, emit metrics via `@aws-sdk/client-cloudwatch` `PutMetricData` (namespace `ArchitectAI`, dimensions `module` / `provider` / `model` / `status`, metrics: `generation_duration_ms`, `total_duration_ms`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `retrieved_chunks`, `retry_count`, `failures`). Fire-and-forget, errors swallowed.
3. **Logs**: keep pino stdout JSON (unchanged, per ADR-0012). Document the Docker `awslogs` log driver as the zero-code path for shipping logs to CloudWatch Logs (`docs/aws/architecture.md`). No code change needed for logs.
4. **Local mode**: `CLOUDWATCH_ENABLED=false` (default) → DB telemetry + stdout logs, exactly as today.

No dashboards, no alarms-as-code, no expensive metric cardinality. The goal is to prove ArchitectAI can emit useful operational signals to AWS.

### 2.4 Scope boundaries (explicit)

**In:** Bedrock provider, S3 document store + export endpoint, telemetry wiring, CloudWatch metrics sink (opt-in), IAM/cost/architecture docs, tests, docs, version bump.

**Out (future sprints):** RDS, ECS/Fargate, ECR, ALB, Route 53, autoscaling, Terraform/CDK, Secrets Manager, streaming, model routing, golden eval datasets, A/B testing, multi-user/RBAC, Bedrock Agents, Kendra/knowledge bases.

---

## 3. Files / Modules Affected

### New files

| File | Purpose |
|---|---|
| `src/llm/providers/bedrock.ts` | `BedrockClient implements LLMClient` + `BedrockConfig` |
| `src/storage/document-store.ts` | `DocumentStore` interface + types |
| `src/storage/local-store.ts` | `LocalDocumentStore` (default) |
| `src/storage/s3-store.ts` | `S3DocumentStore` |
| `src/storage/factory.ts` | `createDocumentStore(config)` |
| `src/storage/export-service.ts` | Server-side engineering-package builder (zip + store) |
| `src/api/routes/export.ts` | `POST/GET /api/export/:projectId` routes |
| `src/telemetry/cloudwatch-sink.ts` | Optional CloudWatch `PutMetricData` emitter |
| `src/db/migrations/008-telemetry-provider.sql` | `ALTER TABLE generation_telemetry ADD COLUMN provider` (additive) |
| `docs/aws/iam.md` | Least-privilege IAM documentation |
| `docs/aws/cost-safety.md` | Cost-awareness + billing alerts + cleanup |
| `docs/aws/architecture.md` | Sprint 7 architecture (local vs AWS mode) |
| `docs/sprint7-summary.md` | Sprint 7 summary |
| `docs/adr/0015-optional-aws-integrations.md` | ADR: AWS as optional, local-first preserved |
| `tests/unit/bedrock-provider.test.ts` | Bedrock request construction, response parsing, fallback, health |
| `tests/unit/bedrock-factory.test.ts` | Provider selection + config validation |
| `tests/unit/document-store.test.ts` | LocalDocumentStore roundtrip (temp dir) |
| `tests/unit/s3-store.test.ts` | Mocked `S3Client`: calls + object-key construction |
| `tests/unit/export-service.test.ts` | Zip build + store via fake DocumentStore |
| `tests/unit/telemetry.test.ts` | GenerationTracker wiring + CloudWatch sink gating |
| `tests/integration/aws/*.test.ts` | Real-AWS tests, gated by `AWS_INTEGRATION_TESTS=1`, **disabled by default** |

### Modified files

| File | Change |
|---|---|
| `src/config/index.ts` | Add `LLM_PROVIDERS` enum member `bedrock`, storage + observability fields, zod validation (§4) |
| `src/llm/factory.ts` | `case 'bedrock':` in `createLLMClient` (+ `createEmbeddingClient` if D2 = yes) |
| `src/llm/providers/index.ts` | Export `BedrockClient` + `BedrockConfig` |
| `src/api/routes/generation.ts` | Wire `tracker.record()` in the six endpoints (+ error paths) |
| `src/api/index.ts` | Mount export router |
| `src/telemetry/generation-tracker.ts` | Add `provider` field; invoke CloudWatch sink when enabled |
| `frontend/src/lib/api.ts` | `exportToStorage`, `getStoredExport` helpers |
| `frontend/src/pages/Generate.tsx` | Optional "Export to storage" action |
| `docs/changelog.md` | v1.3.0 entry |
| `docs/adr/README.md` | Index ADR-0015 |
| `ROADMAP.md` | Reconcile v1.2.0/v1.3.0, mark v2.0.0 AWS items now partially delivered by v1.3.0 |
| `README.md` | AWS mode section (optional), version fix |
| `package.json` | Version `0.1.0` → `1.3.0`; add AWS SDK + jszip deps |

### New dependencies (backend)

`@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-s3`, `@aws-sdk/client-cloudwatch`, `jszip`. (No AWS SDK on frontend.)

---

## 4. New Configuration

All additions follow the existing zod schema in `src/config/index.ts`; all are optional with safe defaults.

| Env var | Config field | Default | Validation / notes |
|---|---|---|---|
| `LLM_PROVIDER` | `llmProvider` | `'openrouter'` (unchanged) | enum gains `'bedrock'` |
| `BEDROCK_MODEL` | `bedrockModel` | `'anthropic.claude-3-5-sonnet-20240620-v1:0'` | non-empty when `llmProvider=bedrock` |
| `BEDROCK_REGION` | `bedrockRegion` | `'us-east-1'` | non-empty when bedrock |
| `BEDROCK_TIMEOUT_MS` | `bedrockTimeoutMs` | `60000` | coerced number |
| `BEDROCK_EMBEDDING_MODEL` | `bedrockEmbeddingModel` | `'amazon.titan-embed-text-v2'` | only if D2 = yes |
| `STORAGE_PROVIDER` | `storageProvider` | `'local'` | `z.enum(['local','s3'])` |
| `STORAGE_LOCAL_DIR` | `storageLocalDir` | `'./data/storage'` | used by LocalDocumentStore |
| `S3_BUCKET` | `s3Bucket` | `''` | **required when `storageProvider=s3`** (never hardcode a default bucket) |
| `S3_REGION` | `s3Region` | `''` | required when s3 (or rely on SDK region resolution) |
| `S3_PREFIX` | `s3Prefix` | `'architectai'` | optional path prefix for object keys |
| `CLOUDWATCH_ENABLED` | `cloudwatchEnabled` | `false` | zod boolean (coerced) |
| `CLOUDWATCH_REGION` | `cloudwatchRegion` | `''` | optional (SDK region resolution otherwise) |
| `CLOUDWATCH_METRICS_NAMESPACE` | `cloudwatchNamespace` | `'ArchitectAI'` | |
| `AWS_INTEGRATION_TESTS` | (test-only) | `'0'` | gates real-AWS integration tests |

**Startup validation summary:** unknown `LLM_PROVIDER`/`STORAGE_PROVIDER` → hard boot failure (existing zod behavior). Missing `S3_BUCKET` with `storageProvider=s3` → hard failure (mirrors the existing `LLM_API_KEY` requirement pattern). AWS credentials are **never** in env by design — resolved via the SDK default credential provider chain at runtime.

---

## 5. Security Implications

- **Credentials**: never hardcoded; no AWS access keys committed; the SDK default credential provider chain resolves credentials (env vars `AWS_ACCESS_KEY_ID/SECRET` are only one stage of the chain and should be avoided in favor of IAM roles in deployed environments). Documented in `docs/aws/iam.md`.
- **Least privilege**: per-resource IAM policies only (Bedrock InvokeModel on specific model ARNs; S3 PutObject/GetObject/DeleteObject/ListBucket scoped to the bucket + prefix; CloudWatch PutMetricData + Logs stream access). No `AdministratorAccess`, no wildcard `*` actions, wildcard resources only where unavoidable (S3 `ListBucket` on the specific bucket ARN is the only acceptable `*` on the object path).
- **Secret leakage**: telemetry records and CloudWatch metrics contain **only numeric values + dimensions** (`module`, `provider`, `model`, `status`) — never prompts, responses, tokens/API keys, or document contents. The pino logger already has no transport; we add no payload logging.
- **S3 access control**: private bucket by default, no public ACLs, SSE-S3 encryption at rest (KMS optional, documented). Object keys use a fixed prefix to scope IAM + reduce enumeration risk.
- **Bedrock access control**: identity-based IAM permissions gate model invocation; requests carry the same system-prompt isolation already enforced by the existing OWASP mitigations (delimiter isolation, output schema validation, bounded retry). AWS path must not bypass ADR-0014 mitigations.
- **OWASP review**: ADR-0014's review trigger ("multi-user deployment") is now live. Sprint 7 re-evaluates the 4 deferred items (LLM03/05/07/08/10) against the AWS additions and records the outcome in the new ADR-0015. Existing mitigations (rate limiting, input size validation, JWT) are untouched.
- **No new attack surface locally**: with AWS disabled, none of the AWS code paths execute; the local runtime is byte-for-byte today's behavior.

---

## 6. Cost Implications

- **Bedrock**: pay-per-token, model-dependent. Usage bounded by existing `maxTokens` (4096) and `LLM_CONTEXT_WINDOW` budget. `isHealthy()` uses a lightweight call. No free tier guarantee — **verify current AWS pricing before use**.
- **S3**: storage per GB-month + PUT/GET request charges + optional cross-region/egress. Export packages are small (KBs–MBs). Free-tier eligible (~5 GB + 20k GET/10k PUT/mo) — **verify current terms**.
- **CloudWatch**: `PutMetricData` (~$0.30 per metric per month, first 10k per month) + Logs ingestion/storage if the `awslogs` driver is used. Kept minimal: 8 metrics, low cardinality, fire-and-forget. This is the component with the most "quiet bleed" risk — hence strict opt-in (`CLOUDWATCH_ENABLED=false`) and documented budgets.
- **No production resources are created automatically.** Nothing in Sprint 7 provisions AWS infrastructure; every integration talks to resources the developer already owns.
- Full cost analysis, disable steps, resource cleanup, and verification in `docs/aws/cost-safety.md`.

---

## 7. Testing Strategy

**No AWS account required for the normal suite.** All AWS integrations are tested with fakes/mocks:

| Concern | Approach |
|---|---|
| Provider selection | Factory test: `createLLMClient` returns `BedrockClient` for `LLM_PROVIDER=bedrock`; unknown provider throws |
| Config validation | Zod: `'bedrock'` accepted; `'foo'` rejected; `storageProvider=s3` without bucket fails |
| Bedrock request construction | Mock `BedrockRuntimeClient.send()` (via `vi.mock`); assert InvokeModel input shape (anthropic_version, model, max_tokens, messages) |
| Bedrock response parsing | Mock response body → assert content + tokenCount extraction; missing usage → chars/4 fallback |
| Bedrock health/errors | Mocked failure → `isHealthy()` returns false; invoke error → thrown, no retry on provider failure (existing `retry.ts` contract) |
| S3 object naming | Mocked `S3Client`; assert `Key = prefix + key`, bucket from config |
| S3 CRUD | Mocked `S3Client`; assert PutObject/GetObject/DeleteObject/ListObjectsV2 inputs + returned Buffer |
| LocalDocumentStore | Real temp dir roundtrip (put → get → list → delete); no AWS involved |
| Export service | Fake DocumentStore; assert zip built (readable with `jszip`), stored under stable key, download returns bytes |
| Telemetry wiring | Mock `pool` + fake CloudWatch sink; assert `record()` called with assembled `GenerationRecord` on success and on failure |
| CloudWatch gating | `cloudwatchEnabled=false` → sink never invoked; `true` → invoked (mock CloudWatch client) |
| Local-mode regression | Full existing suite (5 files) must stay green with AWS env vars unset |

**Integration tests** (`tests/integration/aws/`) run **only** when `AWS_INTEGRATION_TESTS=1` and are excluded from the default Vitest run (`describe.skipIf(!env)`). CI stays on `LLM_PROVIDER=mock`, `STORAGE_PROVIDER=local`, `CLOUDWATCH_ENABLED=false`.

---

## 8. Rollback Strategy

- **Default-on safety**: every AWS feature is opt-in via env flags. Unsetting them returns the system to pure local mode — no code change needed.
- **Version control**: all Sprint 7 work lives on `sprint-7/aws-foundation`. Rollback = revert the merge (or checkout previous tag). The branch is additive; existing files are modified minimally (config + factory + telemetry wiring), and even those changes are backward-compatible.
- **Schema**: the only migration (`008-telemetry-provider.sql`) is an additive `ADD COLUMN` on a table that is currently never written — zero risk to existing data. Safe to leave applied after rollback.
- **Runtime**: with AWS disabled there is no runtime AWS dependency (SDK clients are only constructed when their provider/storage is selected). If a Bedrock/S3 misconfiguration occurs at runtime, the factory throws at construction and the existing error handling surfaces it without crashing other providers.
- **Data**: Postgres artifacts table is untouched; S3/local storage holds only export packages (disposable). No data migration.

---

## 9. Implementation Waves

| Wave | Scope | Exit criteria |
|---|---|---|
| 1 | Config (zod) + Bedrock provider + factory wiring + tests | `npm run typecheck`, `npm test`, `npm run lint` green; local mode untouched |
| 2 | Storage: DocumentStore (Local + S3) + export service + `/api/export` routes + tests | Zip export works locally via `STORAGE_PROVIDER=local`; S3 path mocked-tested |
| 3 | Telemetry wiring (GenerationTracker into 6 routes) + `008` migration + CloudWatch sink + tests | `generation_telemetry` rows written in local mode; CloudWatch only when enabled |
| 4 | Docs: `docs/aws/{iam,cost-safety,architecture}.md`, ADR-0015, README/CHANGELOG/ROADMAP updates | All docs reviewed; cost-safety includes budget + cleanup + verification |
| 5 | Security review + version bump to `1.3.0` + `docs/sprint7-summary.md` + release notes | DoD below fully satisfied |

**Definition of Done** (from the sprint brief) — local mode works, existing + new tests pass, typecheck passes, Bedrock/S3 providers exist and are optional, no hardcoded credentials, IAM documented, CloudWatch minimal, cost-safety doc exists, security reviewed, mocked AWS tests, Docker local dev works, README/roadmap updated, summary written.

---

## 10. Security & Cost Review checklist (performed at end of sprint)

- [ ] No AWS credentials or keys in code, docs, or tests
- [ ] IAM policies are least-privilege (no admin, no wildcard action)
- [ ] Telemetry/metrics contain no prompts, responses, or sensitive content
- [ ] S3 bucket private, SSE enabled, prefix-scoped
- [ ] OWASP LLM mitigations re-verified for the AWS path (ADR-0014 review)
- [ ] Cost-safety doc updated with current verification instructions
- [ ] No production infrastructure created automatically

---

## 11. Open Questions / Decisions Needed

- **D1 (S3 integration point):** recommended = new server-side `/api/export/:projectId` endpoint as the DocumentStore consumer (real purpose, testable). Alternative = mirror every artifact JSON document to the store on write (simpler, but redundant with Postgres). **Recommendation: D1 = export endpoint.**
- **D2 (Bedrock embeddings):** include `bedrock` in `EMBEDDING_PROVIDERS` (Titan embeddings) or keep embeddings on openai/ollama only? **Recommendation: D2 = yes, minimal Titan support**, so `EMBEDDING_PROVIDER=bedrock` is coherent; otherwise document Bedrock generation + non-Bedrock embeddings.
- **D3 (CloudWatch logs):** code-level pino transport vs. documented Docker `awslogs` driver only? **Recommendation: D3 = awslogs driver documented, no code** (zero-cost, per ADR-0012).
- **D4 (version):** **Recommendation: v1.3.0** (minor bump per project versioning policy). Not tagged until sprint completion.
- **D5 (ADR):** create ADR-0015 "AWS integrations are optional" + review ADR-0014. **Recommendation: yes.**
