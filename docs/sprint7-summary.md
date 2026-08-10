# Sprint 7 — AWS Foundation (v1.3.0) Summary

**Branch:** `sprint-7/aws-foundation` · **Version:** 1.3.0 · **Status:** Implementation complete, ready for merge

---

## Goal

Add **optional, opt-in AWS integrations** — Bedrock LLM/embeddings, S3 artifact storage, and CloudWatch telemetry — without changing the local-first default. The application must run identically with zero AWS presence, be testable without an AWS account, and respect hard cost-safety constraints (a prior developer incurred accidental AWS charges).

## What Was Delivered

| Wave | Scope | Status |
|---|---|---|
| 1 | Config (zod) + Bedrock provider + factory wiring + tests | ✅ |
| 2 | DocumentStore (Local + S3) + server-side export + `/api/export` routes + frontend actions + tests | ✅ |
| 3 | Telemetry wiring (6 routes) + migration 008 + CloudWatch sink + tests | ✅ |
| 4 | `docs/aws/{architecture,iam,cost-safety}.md` + ADR-0015 + README/CHANGELOG/ROADMAP + version bump | ✅ |
| 5 | Security review + this summary + DoD | ✅ |

## Decisions Taken

- **D1** — S3 integrated via a new server-side `POST /api/export/:projectId` endpoint (the `DocumentStore` consumer), not by mirroring every artifact.
- **D2** — `EMBEDDING_PROVIDER=bedrock` supported (Amazon Titan embeddings) so Bedrock mode is coherent.
- **D3** — CloudWatch logs via the Docker `awslogs` driver (documented, zero code). Metrics via the new opt-in sink.
- **D4** — Version bumped to **1.3.0** (minor, per project versioning policy). Not tagged until merge.
- **D5** — ADR-0015 created; ADR-0014 deferred OWASP items re-evaluated.

## AWS Services Used (all optional, all pay-per-use)

| Service | Use | Env switch |
|---|---|---|
| **Amazon Bedrock** | Claude generation (Messages API) + Titan embeddings | `LLM_PROVIDER=bedrock`, `EMBEDDING_PROVIDER=bedrock` |
| **Amazon S3** | Engineering-package artifact store (SSE-S3 AES256, prefix-scoped) | `STORAGE_PROVIDER=s3` (+ `S3_BUCKET`) |
| **CloudWatch Metrics** | `PutMetricData` — 10 metrics/gen, dimensions Module/Model/Provider/Status | `CLOUDWATCH_ENABLED=true` |
| **CloudWatch Logs** | Container stdout via Docker `awslogs` driver (no code) | compose `logging.driver` |

No provisioned infrastructure: no RDS, ECS/Fargate, ECR, ALB, Route 53, auto-scaling, or Terraform/CDK. Nothing is created automatically.

## Files Changed

**New — backend:** `src/llm/providers/bedrock.ts`, `src/storage/{document-store,local-store,s3-store,factory,export-service}.ts`, `src/api/routes/export.ts`, `src/telemetry/{cloudwatch-sink,record}.ts`, `src/db/migrations/008-telemetry-provider.sql`

**Modified — backend:** `src/config/index.ts`, `src/llm/factory.ts`, `src/llm/providers/index.ts`, `src/api/routes/generation.ts`, `src/api/index.ts`, `src/telemetry/{index,generation-tracker}.ts`, `src/generation/{spec,arch,task,vision,risk}-generator.ts`

**Frontend:** `src/lib/api.ts` (export helpers), `src/pages/Generate.tsx` (Save to storage / Download stored), `src/components/icons.tsx` (IconUpload)

**Docs:** `docs/aws/{architecture,iam,cost-safety}.md`, `docs/adr/0015-optional-aws-integrations.md`, `docs/adr/README.md`, `docs/changelog.md` (v1.3.0), `ROADMAP.md`, `README.md`, `.env.example`

**Tests (new):** `tests/unit/{bedrock-provider,bedrock-factory,config-aws,document-store,s3-store,export-service,cloudwatch-sink,telemetry-record,generation-tracker}.test.ts`

## Tests Executed

- Backend unit suite: **61 tests across 14 files — all pass** (no AWS account required; AWS SDK clients mocked/faked)
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- Frontend `npm run typecheck` — clean

### LocalStack verification

- S3 + CloudWatch flows verified **end-to-end** against **LocalStack 4.13.1** with **zero AWS spend** (`POST/GET /api/export/:projectId` export flow + CloudWatch telemetry sink).
- Two defects found and fixed during verification:
  1. `S3DocumentStore.listObjects` returned prefixed keys that `getObject` re-prefixed (double `architectai/architectai/...`), breaking `GET /api/export/:id/latest` — now returns keys relative to the store root, consistent with `LocalDocumentStore`.
  2. Added opt-in `S3_FORCE_PATH_STYLE` because the SDK uses virtual-hosted addressing by default, which S3-compatible endpoints like LocalStack reject.
- Container fix: local storage directory `/app/data` is created and owned by the `app` user in the Docker image, with a named volume for persistence (previously `EACCES` on export in the container).

## Security Review ✅

- **No credentials in code/docs/tests.** Grep scan for `AKIA…`, `aws_secret_access_key`, `aws_access_key_id`, `sk-…` found only env-var *name* references in docs. `.env.example` ships AWS vars commented out and off.
- **Credentials never in app config** — resolved exclusively via the AWS SDK default provider chain; prefer IAM roles.
- **IAM least-privilege** (`docs/aws/iam.md`) — exactly `bedrock:InvokeModel` (model ARNs), `s3:PutObject/GetObject/ListBucket` (prefix-scoped), `cloudwatch:PutMetricData` (Resource `*` by API design, write-only). No admin, no wildcard actions.
- **Telemetry contains no sensitive content** — CloudWatch metrics are numeric counts/durations plus Module/Model/Provider/Status dimensions; no prompts, responses, or file contents.
- **S3 private + SSE** — SSE-S3 (AES256) enforced on `putObject`; docs require a private bucket and prefix-scoped IAM.
- **OWASP LLM mitigations re-verified for the AWS path** (ADR-0015) — LLM05 (supply chain) now active due to `@aws-sdk/*` deps (Dependabot); LLM03/07/08/10 unchanged; existing mitigations (delimiter injection protection, output validation, rate limiting, `.architectai-ignore`) unaffected.

## Cost Review ✅

- **Pay-per-use only** — token volume (Bedrock) is the dominant cost; bounded by `maxTokens` (4096), `LLM_CONTEXT_WINDOW` budget, rate limiting, and bounded retry.
- **CloudWatch is the quiet-bleed risk** → strict opt-in (`CLOUDWATCH_ENABLED=false`), 10 low-cardinality metrics, fire-and-forget sink.
- `docs/aws/cost-safety.md` includes: AWS Budgets 50/85/100% + Cost Anomaly Detection, S3 lifecycle (90-day expiry), CloudWatch log-group retention, per-integration disable steps, full cleanup commands, and a verification checklist.
- No free-tier guarantees claimed — docs instruct verifying current AWS pricing.

## Limitations

- **No full deployment** — ECS/RDS/ALB/etc. remain v2.0.0 (see `ROADMAP.md`); Sprint 7 intentionally provides no provisioning/IaC.
- **S3 is export-only** — the `DocumentStore` holds engineering-package zips; the Postgres artifacts table remains the system of record.
- **Retrieval/embedding durations** recorded as 0 for non-RAG routes; token counts reflect the final generation attempt.
- **Credentials/region** come from the SDK chain — document running with `AWS_REGION` set or per-service region envs when using multiple regions.
- **Bedrock streaming, Guardrails, and Secrets Manager** not included (deliberate — see ADR-0015 review triggers).
- Integration tests against real AWS are **not** part of the default suite (gated, disabled by default).

## Version & Sprint 8 Recommendation

- **Version: 1.3.0** (minor per policy). Tag `v1.3.0` at merge time — not before.
- **Sprint 8 recommendation:** **v1.4.0 — Architecture Improvements** (OpenAPI spec generation, database schema generation, streaming responses, proper tokenizer) per the roadmap. It extends the local-first core and keeps momentum without jumping to the major-version AWS deployment. Alternative candidates: *Repository Chat* (deferred since v1.2.0) or beginning **v2.0.0 AWS Deployment** (ECS/RDS/IaC) if a production deployment is actually needed.
- **Do NOT start Sprint 8 in this session.** Sprint 7 is additive and safe to merge; verify the merge, then run the v1.4.0 exploration.

## Definition of Done ✅

- [x] Local mode works with zero AWS (defaults unchanged; full suite green)
- [x] Existing + new tests pass (61), typecheck passes, lint passes
- [x] Bedrock + S3 providers exist and are optional (env-gated)
- [x] No hardcoded credentials anywhere
- [x] IAM documented (least-privilege policy)
- [x] CloudWatch minimal + opt-in
- [x] Cost-safety doc exists (budgets + cleanup + verification)
- [x] Security reviewed (checklist in §10 of the plan)
- [x] AWS integrations mocked-tested (no account required)
- [x] Docker local dev works (unchanged default path)
- [x] README/roadmap updated; summary written
