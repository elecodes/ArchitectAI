# ADR-0016: Security & Production Hardening

## Status

Accepted

## Date

2026-08-11

## Context

Sprint 7 (v1.3.0) made AWS integrations optional and additive (ADR-0015), but the phase-0 audit (`docs/sprint8-audit.md`) and the consolidated security review (`docs/security/sprint8-review.md`) exposed gaps that block a production deployment: arbitrary server-path reads via `/api/review` and `/api/projects/:id/index`, artifact IDOR, per-process in-memory rate limiting with no export/index coverage, no request correlation, a shallow health endpoint, a non-graceful shutdown, no `NODE_ENV=production` gate, a broken Docker HEALTHCHECK (no `curl` in `node:20-slim`), and a Bedrock embedding dimension mismatch that silently disabled RAG indexing.

The audit classified two findings HIGH (S1 arbitrary path read, S2 unbounded path + embedding) and demanded production-readiness controls before enabling CloudWatch/`awslogs` or a real S3 bucket. ADR-0014's review trigger ("multi-user deployment") also pushes toward multi-user readiness, so the hardening must not break the local-first default.

## Decision

Implement Sprint 8 as a production-hardening release. All changes are backward compatible: the local-first, zero-AWS default (ADR-0013, ADR-0015) is preserved, and every new control is configurable via environment variables with safe defaults.

1. **Production environment gate** (`src/config/index.ts`). When `NODE_ENV=production`, config validation fails to boot if `LLM_PROVIDER=mock` or `EMBEDDING_PROVIDER=mock`, and if `JWT_SECRET` is shorter than 32 characters or is in the known-weak set (`dev-secret`, `secret`, `changeme`). A separate always-on refine rejects the placeholder values `dev-secret-change-in-prod` and `changeme`. If `DATABASE_URL` does not contain `sslmode`, a warning is logged (non-fatal) because Amazon RDS requires SSL in production.

2. **Bedrock embedding default is Titan v1** (`src/llm/providers/bedrock.ts`, `src/config/index.ts`). The default `BEDROCK_EMBEDDING_MODEL` is now `amazon.titan-embed-text-v1`, which natively returns 1536-dimension vectors matching the `vector(1536)` column, instead of Titan v2 (which only accepts 256/512/1024 dimensions and previously broke Bedrock RAG indexing). The `dimensions` request parameter is sent only when the configured model includes `v2`. Zod `superRefine` rejects a v2 model combined with a non-v2 dimension set. Titan v2 remains opt-in via `BEDROCK_EMBEDDING_MODEL` + `BEDROCK_EMBEDDING_DIMENSIONS`.

3. **Path containment** (`src/utils/path-safety.ts`). `resolveFsPath`/`resolveContainedPath` resolve a requested path against allowed roots and throw `PathContainmentError` on escape. `ALLOWED_FS_ROOTS` (CSV) configures the roots; when unset, development allows absolute paths (unchanged local UX), while `NODE_ENV=production` fails closed to `process.cwd()`. Enforced by the review and project-index routes, which return `400 PATH_NOT_ALLOWED` on escape.

4. **Artifact IDOR fix** (`src/db/repositories/artifact-repo.ts`). Artifacts have no owner column, so `getArtifact(id, userId)` and `listArtifacts(projectId, userId, type?)` now JOIN through `projects` and filter on `p.owner_id`, returning `null` for non-owned rows (routes map that to 404). The feedback endpoint (`src/api/routes/feedback.ts`) calls the scoped `getArtifact` before upserting, so feedback can only be written for an artifact the caller owns.

5. **Rate limiting** (`src/api/middleware/rate-limiter.ts`). In-memory limiters on top of the existing general (100/min) and generation (10/min) limiters: `exportLimiter` at 10/min (`RATE_LIMIT_EXPORT`) and `indexLimiter` at 5/min (`RATE_LIMIT_INDEX`). `MAX_INDEX_FILES` (default 500) caps per-project indexing volume, bounding embedding cost. No Redis: the store is the in-memory `express-rate-limit` default, accepted as a residual risk for a single-instance deployment (documented as R1 in `docs/security/sprint8-review.md`); `TRUST_PROXY` is wired so limiters see the real client IP behind an ALB/ELB.

6. **Request correlation** (`src/api/middleware/request-id.ts`). An incoming `X-Request-ID` is sanitized (alphanumerics and dashes only, max 64 chars, regenerated if empty) and echoed out on the response. Every request gets a child logger; the access log records only method/path/status/duration — no PII. Mounted first in the middleware stack.

7. **Real health endpoint** (`src/api/routes/health.ts`). `/api/health` now performs actual probes with 2-second timeouts: DB `SELECT 1`, `isHealthy()` on the generation and embedding clients, storage `listObjects('health/')`, and a telemetry status of configured/disabled. It aggregates to `ok`/`degraded`/`error` with HTTP 200/503, includes version/uptime/timestamp, and never throws.

8. **Graceful shutdown** (`src/index.ts`). SIGTERM/SIGINT stop accepting new connections (`server.close()` + `closeIdleConnections()`), drain in-flight requests, then close the database pool and exit 0. If the drain exceeds `GRACE_PERIOD_MS` (default 10000), the process force-exits with `closeAllConnections()` and exit code 1.

9. **Docker HEALTHCHECK** (`Dockerfile`). The healthcheck uses `node -e "fetch(...)"` instead of `curl` because `node:20-slim` ships no `curl`; `--start-period=40s` tolerates boot time.

10. **CI / dependency updates** (`.github/dependabot.yml`). Dependabot covers the root npm manifest, the `frontend/` npm workspace, and GitHub Actions — all on a weekly schedule.

## Consequences

### Positive

- The two HIGH audit findings (arbitrary path read, unbounded indexing) and the production-readiness gaps (HEALTHCHECK, health depth, shutdown, prod gate, request IDs, Titan dimension mismatch) are closed in code.
- Bedrock RAG indexing works again out of the box — the default Titan v1 model matches the `vector(1536)` schema contract.
- Local-first is preserved: every control is opt-in via env with defaults that keep `npm run dev` behavior unchanged.
- PII hygiene (access log, query snippets, generic error bodies) aligns with ADR-0012/0014 and the AWS observability posture.
- The release checklist in `docs/security/sprint8-review.md` §6 gives a concrete human gate before any paid AWS service is enabled.

### Negative

- More configuration surface to document and validate (seven new env vars, mitigated by the zod schema).
- In production, path-based review/index now require `ALLOWED_FS_ROOTS` to point at the mounted project volume — a deliberate constraint on where the server may read.
- The health endpoint adds up to three probe round-trips (DB, two LLM clients, storage) on every request, though all are bounded by the 2s timeout and run concurrently.

### Risks

- **In-memory rate limiting** remains per-process: a multi-instance ECS deployment would give per-instance counters and one shared ALB IP would make limiters global unless `TRUST_PROXY` is set. Accepted for the single-instance target; Redis is the documented remediation (sprint8-review.md R1) when the service scales beyond one task.
- **JWT algorithm pinning** is still deferred — `jwt.verify` uses the secret only, no `algorithms` option. The production gate covers the weak-secret case; pinning is scoped to the v2.1.0 roadmap.
- **`sslmode` is warning-only** in code; the deploy-blocking check remains a manual step in the release checklist.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- The service runs more than one instance in production (Redis rate-limit store becomes required)
- A second consumer of path resolution needs semantics outside containment (e.g. mount points outside `ALLOWED_FS_ROOTS`)
- A non-Titan Bedrock embedding model is added, breaking the v1/v2 dimension convention
- Multi-user deployment begins (ADR-0014 review trigger) and the authz model needs to move beyond the single-owner JOIN
- v2.0.0 AWS deployment work begins — the manual release-checklist steps should become automated

## Alternatives Considered

**Redis for the rate-limit store now:** Rejected. Adds an infrastructure dependency and a single point of failure for an explicitly single-instance deployment; the in-memory store with `TRUST_PROXY` is correct at this scale, and Redis is scoped as the multi-instance remediation (sprint8-review.md R1).

**Disable Titan v2 embeddings entirely:** Rejected. v2 stays available as an opt-in for teams that want smaller vectors; the schema-enforced `BEDROCK_EMBEDDING_DIMENSIONS` (256/512/1024) plus a column migration keeps the dimension contract explicit instead of silently breaking it.

**Constrain paths to `process.cwd()` in development too:** Rejected. It would break the local UX of pointing review/index at any local folder, which is the product's core value; the fail-closed production behavior plus opt-in `ALLOWED_FS_ROOTS` provides the security boundary where it matters.

**Full JWT hardening (algorithm pinning, issuer/audience) now:** Rejected. HS256 with a strong, gate-enforced secret is safe today; pinning is a multi-user (v2.1.0) requirement and adding it now would churn `auth.ts` for no current attacker benefit.
