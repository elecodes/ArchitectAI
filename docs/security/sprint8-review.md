# Sprint 8 — Security Review

**Branch reviewed:** `sprint-8/aws-hardening`
**Audit source:** `docs/sprint8-audit.md` (2026-08-11, v1.3.0 baseline)
**Date:** 2026-08-11
**Scope:** Consolidated security review of the Sprint 8 hardening work. Every FIXED claim below was verified against the code on this branch (file/line cited); no build or test was run.

---

## 1. Executive summary

This review consolidates the Sprint 8 security hardening: it re-verifies every finding (S1–S12) from the phase-0 audit (`docs/sprint8-audit.md`), the production-readiness and database-readiness gaps, re-checks the OWASP LLM Top 10 posture from ADR-0014 against the new AWS surface, and evaluates the AWS-specific security of the Bedrock/S3/CloudWatch integrations documented in `docs/aws/*.md`.

The posture has moved from **local-first single-user (ADR-0014)** to **production-capable**: the application still defaults to zero-AWS local mode (ADR-0015 preserved), but the deployment prerequisites the audit demanded are now in place. The two HIGH security findings (S1 arbitrary path review, S2 arbitrary path + unbounded embedding) are **FIXED** in code via `src/utils/path-safety.ts` containment, `ALLOWED_FS_ROOTS`, `MAX_INDEX_FILES`, and dedicated index/export limiters. The three HIGH production-readiness gaps (Docker HEALTHCHECK, arbitrary-path endpoints, Titan dimension mismatch) are also closed. The Titan dimension bug — which silently disabled Bedrock RAG indexing — is fixed by making **Titan v1 the embedding default** (1536 dims, matching `vector(1536)`) with schema-enforced dimensions for the opt-in v2 path.

No critical or high issues remain open. Residual exposure is **medium/low, all documented**: rate limiting is still in-memory per-process (fine for single-instance), CORS stays hardcoded to `http://localhost:3000` with no helmet headers, JWT algorithm pinning is deferred to the v2.1.0 roadmap, and several operational controls (S3 lifecycle, log retention, budgets, pool timeouts) are documented-as-manual rather than in code. Verdict: **ready to proceed to the release verification checklist (§6) before enabling CloudWatch/`awslogs` or a real S3 bucket.**

---

## 2. Audit findings disposition

### 2.1 Security findings (S1–S12, `docs/sprint8-audit.md` §Security findings)

| Finding | Severity | Status | Evidence | Notes |
|---|---|---|---|---|
| S1 — Arbitrary server-path read via `/api/review` | HIGH (prod) | **FIXED** | `src/api/routes/review.ts:51` → `resolveFsPath()`; `src/utils/path-safety.ts:23-29` | Containment enforced when `ALLOWED_FS_ROOTS` is set **or** `NODE_ENV=production` (fail-closed to `process.cwd()`); escapes return `400 PATH_NOT_ALLOWED` (`review.ts:53-57`) |
| S2 — Arbitrary path + unbounded embedding via `/index` | HIGH (prod + cost) | **FIXED** | `src/api/routes/projects.ts:95` (`resolveFsPath`); `projects.ts:79` (`indexLimiter` 5/min); `projects.ts:108` (`config.maxIndexFiles`) | Path containment + `MAX_INDEX_FILES` default 500 (`config/index.ts:29`) + dedicated 5/min index limiter bound the embedding-volume primitive |
| S3 — Dependabot not configured | MEDIUM | **FIXED** | `.github/dependabot.yml` (github-actions + npm, weekly) | Root `package.json` covered; the `frontend/` npm workspace is **not** covered — see residual risk R7 |
| S4 — IDOR on artifacts | MEDIUM (→HIGH multi-user) | **FIXED** | `src/db/repositories/artifact-repo.ts:42-51` (`getArtifact` JOIN `p.owner_id`), `:53-67` (`listArtifacts` JOIN) | All call sites pass `req.userId`: `generation.ts:198,268,341,401,407,472`, `artifacts.ts:11`, `export.ts:27`. Minor note: `feedback.ts:26-31` upserts feedback without an ownership check but returns no artifact data (low, out of audit scope) |
| S5 — Raw provider error bodies leaked | MEDIUM | **FIXED** | `generation.ts:174,244,306,376,447,524` (generic `GENERATION_FAILED`); `review.ts:99-101`; `error-handler.ts:15` | Provider/parse detail is logged server-side only; clients get a generic message |
| S6 — Per-process in-memory rate limiting; export/review only general limiter | MEDIUM (prod) | **MITIGATED** | `rate-limiter.ts` (export 10/min, index 5/min); mounts `export.ts:19`, `projects.ts:79`; `api/index.ts:23` (`trust proxy` from config) | Trust proxy + export/index limiters added. Store remains in-memory per-process — accepted for single-instance; Redis is the multi-instance remediation (R1) |
| S7 — JWT: no algorithm pinning / issuer / audience | LOW | **ACCEPTED** | `src/api/middleware/auth.ts:19` (`jwt.verify(token, config.jwtSecret)`) | No `algorithms: ['HS256']` option; pinned to v2.1.0 roadmap. **Prod gate covers the weak-secret case**: `config/index.ts:105-111` rejects `JWT_SECRET < 32 chars` or in `WEAK_JWT_SECRETS` when `NODE_ENV=production` |
| S8 — Sensitive-file blocking missing in review path | LOW | **FIXED** | `src/review/repository.ts:4,98` (mirrors `DEFAULT_IGNORE_PATTERNS`); `src/review/pipeline.ts:181-190` | Key files narrowed to README/package.json/index/main/app — `*.config.*` no longer sent to the LLM |
| S9 — Query snippet + filesystem paths logged | LOW | **FIXED** | `src/rag/retriever.ts:56` (`query.slice(0,100)` + whitespace normalize); `review.ts:64` (`path.slice(0,500)`); `request-id.ts:30` | Access log carries method/path/status/durationMs only — no PII. Truncated snippets remain in logs; retention policy documented (14d) |
| S10 — Weak `.architectai-ignore` matching (`includes`) | LOW | **FIXED** | `src/rag/file-parser.ts:77-81` (`matchesIgnore`, glob-aware with dir-segment fallback); used `file-parser.ts:123`, `repository.ts:103` | `*.ext`, `prefix.*`, dir/`, exact, and bare-dir segment matching |
| S11 — `data/` not gitignored | LOW | **FIXED** | `.gitignore:4-5,10` (`.env.*`, `!.env.example`, `data/`); `.dockerignore` (`data/`) | Both git and docker coverage added |
| S12 — Sprint 2.5 mitigations intact | ✅ | **VERIFIED OK** | `src/prompts/spec-v1.md:23-24`; `src/generation/output-validator.ts`; `retry.ts:27-80`; `rate-limiter.ts`; `auth.ts` | Delimiter isolation, zod output validation, rate limits, JWT all present; AWS additions are provider-agnostic (ADR-0015 §Re-evaluation) |

### 2.2 Production readiness gaps

| Severity | Gap | Status | Evidence |
|---|---|---|---|
| HIGH | Docker HEALTHCHECK fails (no `curl`) | **FIXED** | `Dockerfile:38` — `node -e "fetch('http://localhost:3001/api/health')..."` |
| HIGH | Arbitrary-path endpoints (S1/S2) | **FIXED** | see S1/S2 above |
| HIGH | Bedrock RAG indexing broken (dimension mismatch) | **FIXED** | `config/index.ts:59` default `amazon.titan-embed-text-v1` (1536 native); `bedrock.ts:87-89` sends `dimensions` **only** for v2; `config/index.ts:119-128` enforces v2 dims 256/512/1024 |
| MEDIUM | Health endpoint shallow (LLM placeholder) | **FIXED** | `src/api/routes/health.ts` — real probes: DB `SELECT 1`, `llm.isHealthy()` (generation + embedding), storage `listObjects('health/')`, 2s timeouts, 200/503 aggregate |
| MEDIUM | Graceful shutdown not graceful | **FIXED** | `src/index.ts:39-68` — `server.close()` + `GRACE_PERIOD_MS` drain, `closeAllConnections()` + `exit(1)` on timeout |
| MEDIUM | No `NODE_ENV=production` gate | **FIXED** | `config/index.ts:90-118` — rejects `mock` providers, weak/short `JWT_SECRET`, warns on missing `sslmode` |
| MEDIUM | CORS hardcoded localhost:3000; no helmet | **ACCEPTED** | `api/index.ts:27` (`cors({ origin: 'http://localhost:3000' })`); no `helmet` | Single-user local-first MVP (ADR-0014); configurable origin + security headers are multi-user deployment work (R2) |
| MEDIUM | No request correlation IDs | **FIXED** | `src/api/middleware/request-id.ts` — sanitized `X-Request-ID` in/out, `req.log` child, access log on finish; mounted first at `api/index.ts:26` |
| MEDIUM | Rate limiting in-memory (no trust proxy / shared store) | **MITIGATED** | see S6 |
| MEDIUM | DB: no SSL option / no timeouts | **ACCEPTED** | `src/db/connection.ts:7-10` (pool `max:10` only); `config/index.ts:112-117` warns on missing `sslmode` | SSL warning in place; RDS `sslmode` + tuning documented as recommendations in `docs/aws/database-readiness.md` (R5) |

### 2.3 Database readiness rows (`docs/sprint8-audit.md` §Database readiness)

| Row | Status | Evidence / Notes |
|---|---|---|
| pgvector on RDS (verify minor) | ACCEPTED | compose stays `pgvector/pgvector:pg16`; operational check at deploy |
| Migrations 001–008 runner | OK | `src/db/migrate.ts`; additive 008 preserved |
| **Dimension contract `vector(1536)`** | **FIXED** | default Titan v1 = 1536 native; v2 path requires explicit `BEDROCK_EMBEDDING_DIMENSIONS` + column migration (schema-enforced) |
| SSL in connection string/client | ACCEPTED | warning-only in code; deploy-blocking manual check per `docs/aws/secrets.md` |
| Pool timeouts / query timeout | ACCEPTED | not in code; documented recommendation (R5) |
| Backups / retention | ACCEPTED | RDS snapshots + telemetry retention documented (ADR-0012 unbounded accepted) |

---

## 3. OWASP LLM Top 10 re-check (2025)

Re-verified against the current codebase, including the new AWS surface (ADR-0015 §Re-evaluation holds).

| Category | Posture | Controls / Evidence |
|---|---|---|
| **LLM01 — Prompt Injection** | **POSTURE STRONG** | Delimiter isolation (`<CONTEXT>` / `<USER_INPUT>`, "do not follow instructions", `spec-v1.md:23-24`); zod output validation; provider-agnostic prompts — intact across providers incl. Bedrock. Residual: delimiter isolation is defense-in-depth, not proof (ADR-0014 consequence) |
| **LLM02 — Sensitive Information Disclosure** | **POSTURE STRONG** | `DEFAULT_IGNORE_PATTERNS` blocks `.env`, keys, `.aws/`, `.ssh/` in **both** RAG (`file-parser.ts:15-29`) and review (`repository.ts:4,98`); secrets never in config/code (AWS SDK chain only); error + log hygiene (S5, S9); `/api/health` and access log carry no PII |
| **LLM03 — Insecure Output Handling** | **POSTURE STRONG** | Zod schemas on all LLM output via `OutputValidator` + bounded retry (≤2, `retry.ts:27-80`); structural validators per generator |
| **LLM04 — Unbounded Consumption** | **POSTURE ADEQUATE** | In-code: general/generation/export/index limiters, `MAX_INDEX_FILES=500`, `maxTokens: 4096`, retry ≤2, `LLM_CONTEXT_WINDOW` budget, CloudWatch opt-in OFF. Gap: budgets, S3 lifecycle, log retention are **manual AWS steps** (R6, §6) |
| **LLM07 — Excessive Agency** | **POSTURE STRONG** | No tool-use capability; single 6-stage sequential pipeline (ADR-0002); Bedrock is a pure `InvokeModel` call — no function-calling loop |
| **System Prompt Leakage** | **POSTURE STRONG** | Prompts are local files (`src/prompts/*.md`) loaded server-side; no endpoint exposes prompt content to clients |
| **Vector & Embedding Weaknesses** | **POSTURE STRONG** | Dimension contract fixed (Titan v1 default 1536 ↔ `vector(1536)`; v2 dims validated); embeddings never leave the app except as pgvector rows; path containment (S1/S2) removes the indexing-exfiltration primitive; no data-exfil vector via the embed call itself |

---

## 4. AWS-specific security

| Control | Status | Evidence |
|---|---|---|
| **IAM least privilege** | **FIXED** | Two exact Bedrock model ARNs (+ optional `bedrock:ModelId` condition), S3 scoped to one bucket + `architectai/` prefix, `cloudwatch:PutMetricData` on `*` (unavoidable, write-only) — `docs/aws/iam.md` §3 |
| **Secrets** | **FIXED** | AWS creds resolved only via SDK default provider chain, never app config; Secrets Manager recommendation with ECS `secrets:` syntax; `NODE_ENV=production` gate (mock rejected, `JWT_SECRET` ≥32 chars) — `docs/aws/secrets.md` §2–3 |
| **Network** | **FIXED** | No NAT by default; SG egress via VPC endpoints (bedrock-runtime, monitoring, logs + free S3 gateway); task private / ALB-only ingress; `TRUST_PROXY=true` behind ALB so limiters see the real client IP — `docs/aws/networking.md` §2, §4, §6 |
| **Observability** | **FIXED** | No prompts/keys/PII in CloudWatch metrics (10 numeric, low-cardinality dims); query snippets truncated + whitespace-normalized; access log without query/PII; 14d log retention documented — `docs/aws/observability.md` §4–5 |
| **Data at rest** | **FIXED** | Export zips encrypted with SSE-S3 (`AES256`, `src/storage/s3-store.ts:48`) — no KMS key or `kms:*` permission needed; documented in `docs/aws/iam.md` §3 |
| **Cost (security-adjacent)** | **ADEQUATE** | In-app caps (limiters, `MAX_INDEX_FILES`) in code; budgets (ACTUAL + FORECASTED @80%), S3 lifecycle, log retention are manual — `docs/aws/cost-control.md` §1, §4–5 |

---

## 5. Residual risk register

| # | Risk | Severity | Rationale | Remediation trigger |
|---|---|---|---|---|
| R1 | Rate-limit store in-memory per-process | LOW (single-instance) | Multi-instance (ECS desiredCount > 1) means per-instance counters; one ALB IP + `TRUST_PROXY` is the only correct today | When the service scales beyond 1 task → Redis store + configurable `keyGenerator` |
| R2 | CORS hardcoded `http://localhost:3000`; no helmet/security headers | MEDIUM (multi-user) | No configurable origin; no CSP/HSTS/X-Content-Type-Options | Multi-user or public deployment → configurable CORS origin + `helmet` |
| R3 | JWT algorithm/issuer/audience not pinned | LOW | `auth.ts:19` verifies with secret only; HS256 default is safe today; prod gate blocks weak secrets | v2.1.0 roadmap (algorithm pinning + issuer/audience) |
| R4 | Telemetry rows carry no `requestId` | LOW | Logs correlate by `requestId`; `generation_telemetry` rows correlate only by timestamp+module (approximate) | Add `request_id` column (additive migration) when exact correlation is needed |
| R5 | Pool timeouts not in code | LOW | `connection.ts` sets `max:10` only; no `connectionTimeoutMillis`/`statement_timeout` | RDS/Fargate deployment → add pg pool timeouts + query timeouts |
| R6 | CloudWatch/log retention is manual (`awslogs` driver not in compose) | LOW | App logs to stdout; shipping depends on the ECS `awslogs` driver; retention is a `put-retention-policy` step | Before/at production deploy → apply retention + verify awslogs driver (see §6) |
| R7 | Dependabot does not cover `frontend/` npm workspace | LOW | `.github/dependabot.yml` covers root npm + github-actions only; `frontend/package.json` exists | Add a `frontend/` npm entry to dependabot.yml |
| R8 | `.env.*` history if ever committed | LOW (hygiene) | `.gitignore` now ignores `.env.*`; risk is pre-existing history | If a past commit holds secrets → rotate + filter-repo; otherwise monitor |
| R9 | Budgets/S3 lifecycle/manual steps not enforced in code | MEDIUM (cost) | Prior cost incident (ADR-0015); controls are documented CLI, not automated | Before enabling any paid AWS service → run §6 steps |

---

## 6. Verification checklist for release

A human runs this **before** enabling CloudWatch/`awslogs`, pointing at a real S3 bucket, or deploying to ECS/Fargate. Items reference the exact CLI in the docs.

- [ ] **Budgets created** — `aws budgets create-budget` ($10/mo, ACTUAL + FORECASTED @ 80%, SNS) + Cost Anomaly Detection (`docs/aws/cost-control.md` §1)
- [ ] **S3 lifecycle applied** — Glacier after 90d, expire after 365d on `architectai/` prefix; `get-bucket-lifecycle-configuration` confirms (`cost-control.md` §4)
- [ ] **Log retention 14d** — `aws logs put-retention-policy --log-group-name /architectai/api --retention-in-days 14`; re-apply after log-group recreation (`cost-control.md` §5)
- [ ] **`ALLOWED_FS_ROOTS` set** to the mounted project volume — prod fails closed to `process.cwd()` otherwise (`path-safety.ts:24`)
- [ ] **`TRUST_PROXY=true`** when behind the ALB — otherwise all users share the ALB IP and limiters become global (`networking.md` §6)
- [ ] **`NODE_ENV=production`** + **`JWT_SECRET` ≥ 32 chars** and not in `WEAK_JWT_SECRETS` (boot fails otherwise) (`config/index.ts:90-111`)
- [ ] **Embedding contract** — `BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1` (default) **or** v2 with `BEDROCK_EMBEDDING_DIMENSIONS` 256/512/1024 **plus** `ALTER TABLE indexed_chunks ALTER COLUMN embedding TYPE vector(...)` + HNSW rebuild (`cost-control.md` §3.4)
- [ ] **`RATE_LIMIT_*` reviewed** — general/generation/export/index values validated in the task definition (they are not zod-validated; a typo silently falls back to defaults) (`cost-control.md` §2)
- [ ] **Dependabot PRs triaged** — weekly root npm + github-actions updates; `frontend/` npm entry added (R7)
- [ ] **`aws iam simulate-principal-policy` passes** — `allowed` for both model ARNs, S3 ops, `PutMetricData`; `denied` for a non-approved model (`iam.md` §6.1)
- [ ] **SSL in `DATABASE_URL`** — `sslmode=require` present (deploy-blocking manual check; warning-only in code)

---

## Related

- `docs/sprint8-audit.md` — phase-0 audit (findings, cost risks, readiness gaps)
- `docs/adr/0014-llm-security-mitigations.md`, `docs/adr/0015-optional-aws-integrations.md`
- `docs/aws/{secrets,iam,networking,observability,cost-control,architecture,cost-safety,database-readiness}.md`
