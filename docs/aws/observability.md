# ArchitectAI on AWS — Observability

What ArchitectAI ships today for observability, what each signal means operationally, and how to collect it on ECS/Fargate. The design follows **ADR-0012 (AI-focused telemetry over general observability)** and **ADR-0015 (AWS integrations optional)**.

Four signals exist today:

| Signal | Source | Where it lands |
|---|---|---|
| Structured logs (pino JSON) | `src/logger.ts` → stdout | CloudWatch Logs via the `awslogs` driver |
| Request correlation + access log | `src/api/middleware/request-id.ts` | Same stdout stream (with `requestId`) |
| Generation metrics (10 CloudWatch metrics) | `src/telemetry/cloudwatch-sink.ts` | CloudWatch Metrics (opt-in) |
| Generation telemetry rows | `src/telemetry/generation-tracker.ts` | Postgres `generation_telemetry` (ADR-0012) |

---

## 1. Health endpoint semantics

`GET /api/health` (`src/api/routes/health.ts`) is **public** (mounted before auth) and is the intended ECS container health + ALB target.

It probes four components in parallel, each wrapped in a **2-second timeout** (`PROBE_TIMEOUT_MS`):

| Component | Probe | Healthy means |
|---|---|---|
| `database` | `SELECT 1` on the pool | DB reachable and authenticating |
| `llm` | `isHealthy()` on **both** generation and embedding clients | Generation: provider configured + (Bedrock) credentials resolve via the default chain; OpenAI/OpenRouter resolve the API key. Embedding client reported separately as `llm.generation` / `llm.embedding` |
| `storage` | read-only `listObjects('health/')` on the configured store | S3 bucket/prefix readable (local store always passes) |
| `telemetry` | config check only | `status: 'configured'` — message is `CloudWatch sink enabled` or `Telemetry sink disabled`; never fails the endpoint |

Aggregate status:

| Status | Condition | HTTP | Operational meaning |
|---|---|---|---|
| `ok` | database + llm + storage all healthy | 200 | Fully serving |
| `degraded` | database healthy, but **llm or storage unhealthy** | 503 | Serving but a model/S3 dependency is down — generations fail or store unavailable |
| `error` | database unhealthy | 503 | DB is the root dependency (auth, projects, telemetry, RAG all hit it) — effectively down |

Response body includes `version`, `uptime` (seconds), and `timestamp` for drift checks:

```json
{
  "status": "ok",
  "components": {
    "database": { "status": "healthy" },
    "llm": { "status": "healthy", "generation": { "status": "healthy" }, "embedding": { "status": "healthy" } },
    "storage": { "status": "healthy" },
    "telemetry": { "status": "configured", "message": "CloudWatch sink enabled" }
  },
  "version": "1.4.0",
  "uptime": 1234.5,
  "timestamp": "2026-08-11T12:00:00.000Z"
}
```

Operational notes:

- **Boot is non-gating.** `src/index.ts` logs `isHealthy()` at startup but does not block on it; the health endpoint is the readiness signal, not the boot path.
- Probes that time out report `unhealthy` with `probe failed: probe timed out` — a stuck dependency shows up as unhealthy rather than hanging the endpoint.
- A degraded-but-200 pattern (returning 200 with `degraded`) is a common alternative; this app intentionally returns **503 for anything but `ok`** so an ALB can drain/remove the task automatically.

**Use it as:**
- ECS container health — already baked into the image `HEALTHCHECK` (`node -e fetch http://localhost:3001/api/health`, interval 10s, start-period 40s).
- ALB target group health — HTTP `GET /api/health`, port 3001, treat 200 = healthy / 503 = unhealthy.

---

## 2. Structured logs (pino JSON → stdout)

All logs are pino JSON lines to stdout (ADR-0012), one JSON object per line:

```json
{"level":30,"time":1754400000000,"pid":1,"hostname":"ip-10-0-11-5","requestId":"a1b2c3d4-...","msg":"request complete","method":"GET","path":"/api/projects","status":200,"durationMs":42}
```

- Fields are flat JSON — parseable by CloudWatch Logs Insights, `jq`, or any agent.
- **No PII in the access line:** method, path (`req.path` — no query string), status, durationMs. No headers, no body, no IP, no user agent.

---

## 3. Request correlation — tracing one generation

`src/api/middleware/request-id.ts` runs first on every request:

1. **X-Request-ID in:** an incoming `X-Request-ID` header is sanitized (only `[A-Za-z0-9-]`, truncated to 64 chars) or a `randomUUID()` is generated.
2. **X-Request-ID out:** the same value is echoed on the response header.
3. **`req.log` child:** a pino child logger is bound to the request with `requestId`, so every downstream log inside that request carries it.
4. **Access log:** on `finish`, the middleware emits `request complete` with `method`/`path`/`status`/`durationMs` on that same child.

To trace one generation end-to-end in CloudWatch Logs:

1. Take the `X-Request-ID` from a `POST /api/architecture` response header (or the client's own value).
2. Query `filter @message.requestId = "a1b2c3d4-..."` (or `fields @message.requestId` in Logs Insights) to see every log line of that request: `Starting...`, provider `completion finished`, `request complete`.
3. For the **cost/quality record**, find the matching `generation_telemetry` row by `timestamp` + `module` window (the telemetry row does **not** carry `requestId` today — see the gap in §6).

---

## 4. CloudWatch Metrics sink (opt-in)

`CLOUDWATCH_ENABLED=true` turns on `src/telemetry/cloudwatch-sink.ts`. Off by default; the SDK client is **dynamically imported** so local runs never initialize it, and the sink is **fire-and-forget** (a failure is logged, never blocks a generation).

**Exactly 10 numeric metrics per generation**, Namespace `CLOUDWATCH_METRICS_NAMESPACE` (default `ArchitectAI`), dimensions `Module` / `Model` / `Provider` / `Status` (Provider defaults to `local`):

| Metric | Unit | Meaning |
|---|---|---|
| `GenerationDuration` | Milliseconds | Time in the LLM completion call |
| `EmbeddingDuration` | Milliseconds | Time in the embedding call |
| `RetrievalDuration` | Milliseconds | Time in the pgvector retrieval |
| `TotalDuration` | Milliseconds | Full pipeline duration |
| `PromptTokens` | Count | Input tokens consumed |
| `CompletionTokens` | Count | Output tokens produced |
| `TotalTokens` | Count | Input + output |
| `RetrievedChunks` | Count | Chunks pulled by retrieval |
| `FittedChunks` | Count | Chunks that fit the context budget |
| `ContextWindowUsed` | Count | Context window tokens used |

**No prompts, responses, or keys ever enter metrics.** Dimensions are low-cardinality (`Module` = the six generator modules, `Model`, `Provider`, `Status` = success/validation_retry/failure). Query examples:

```bash
aws cloudwatch get-metric-statistics \
  --namespace ArchitectAI --metric-name TotalTokens \
  --dimensions Name=Module,Value=architecture Name=Provider,Value=bedrock \
  --start-time "$(date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)" --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 3600 --statistics Sum
```

Cost note: one `PutMetricData` call (10 data points) per generation; first 10,000 custom metrics/month free — see `docs/aws/cost-control.md`.

---

## 5. CloudWatch Logs via the `awslogs` driver

The app writes logs to stdout only; the **container runtime** ships them to CloudWatch Logs. No application code change (ADR-0015).

### 5.1 ECS/Fargate (task definition)

```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/architectai/api",
    "awslogs-region": "us-east-1",
    "awslogs-stream-prefix": "app"
  }
}
```

The **execution role** needs `logs:CreateLogStream` + `logs:PutLogEvents` on the log group (the Fargate agent ships stdout as the execution role — see `docs/aws/iam.md` §3).

### 5.2 Plain Docker (no compose)

```bash
docker run --log-driver awslogs \
  --log-opt awslogs-group=/architectai/api \
  --log-opt awslogs-region=us-east-1 \
  --log-opt awslogs-stream-prefix=app \
  -p 3001:3001 123456789012.dkr.ecr.us-east-1.amazonaws.com/architectai:latest
```

### 5.3 EKS (pod-level)

```yaml
spec:
  containers:
    - name: api
      image: 123456789012.dkr.ecr.us-east-1.amazonaws.com/architectai:latest
      logConfig:
        driver: awslogs
        options:
          awslogs-group: /architectai/api
          awslogs-region: us-east-1
          awslogs-stream-prefix: app
```

### 5.4 Retention and S9 (data hygiene)

- CloudWatch log groups default to **never expire**. Set a 14-day retention policy (recommended):

```bash
aws logs put-retention-policy --log-group-name /architectai/api --retention-in-days 14
```

- **S9 note (audit finding):** query snippets (`src/rag/retriever.ts`) and filesystem paths (review route) are logged to stdout and therefore land in CloudWatch Logs. Paths are truncated to 500 chars and snippets should be considered sensitive — treat the log group accordingly (restricted access, 14-day retention, and prefer `BEDROCK_EMBEDDING_DIMENSIONS`-level errors over full-path dumps).

---

## 6. Telemetry to Postgres (ADR-0012)

`GenerationTracker.record()` inserts one row into `generation_telemetry` per generation (all six generator modules, success **and** failure paths) and also emits the record as a pino log line. Schema: `src/db/migrations/005-telemetry.sql`, additive `provider` column in migration 008.

| Field | Notes |
|---|---|
| `module`, `model`, `provider`, `prompt_version` | Provenance + cost attribution per provider |
| `*_duration_ms`, `*_tokens`, `retrieved_chunks`, `fitted_chunks` | Mirrors the 10 CloudWatch metrics |
| `status` | `success` / `validation_retry` / `failure` |
| `truncated`, `context_window_*`, `similarity_scores` | Context-window and RAG quality |
| `retry_count`, `error_category` | Failure analysis |

**Gap:** the telemetry row does not include `requestId`, so logs (by `requestId`) and telemetry rows (by `timestamp`+`module`) are correlated approximately, not exactly. Adding a `request_id` column is a small additive migration when exact correlation is needed.

The table grows unbounded by design (ADR-0012 accepts this for MVP). For RDS, plan a retention cleanup — see `docs/aws/database-readiness.md` §6 and `docs/aws/cost-control.md`.

---

## 7. Sprint 8 runtime env quick reference

The hardening env vars introduced this sprint, where they live, and where each is documented:

| Env var | Default | Effect | Documented in |
|---|---|---|---|
| `TRUST_PROXY` | `false` | Express `trust proxy` — rate limiter sees the real client IP behind an ALB | `networking.md` §6 |
| `ALLOWED_FS_ROOTS` | `''` (comma-separated) | Allowlist of filesystem roots for `/api/review` and `/api/projects/:id/index`; enforced when set or when `NODE_ENV=production` (fail-closed to `process.cwd()`); escapes → `400 PATH_NOT_ALLOWED` | `src/utils/path-safety.ts` |
| `MAX_INDEX_FILES` | `500` | Hard cap on files indexed per `/index` run — bounds embedding cost | `cost-control.md` §2–3 |
| `GRACE_PERIOD_MS` | `10000` | Graceful-shutdown drain window: `server.close()` drains in-flight requests; idle/remaining connections are force-closed and the process exits `1` if the grace period elapses (`src/index.ts`) | this document, §8 |
| `BEDROCK_EMBEDDING_DIMENSIONS` | `1536` | Default embedding model is Titan v1 (1536 native, no `dimensions` field sent). Only sent for the opt-in v2 model, which must be 256/512/1024 (schema-enforced) | `cost-control.md` §3.4, `database-readiness.md` §5 |
| `RATE_LIMIT_EXPORT` | `10` | Export endpoint limit/min (read by the limiter directly, not the zod schema) | `cost-control.md` §2 |
| `RATE_LIMIT_INDEX` | `5` | Index endpoint limit/min — the embedding-cost endpoint | `cost-control.md` §2 |

Other runtime vars (`PORT`, `LOG_LEVEL`, `EMBEDDING_MODEL`, `OLLAMA_URL`, Bedrock/S3/CloudWatch regions and timeouts) are pre-existing and documented in `docs/aws/architecture.md` §3.

---

## 8. Graceful shutdown (SIGTERM/SIGINT)

`src/index.ts` handles `SIGTERM`/`SIGINT`:

1. Stop accepting new connections (`server.close()`), close idle keep-alives.
2. Drain in-flight requests; the health endpoint stays up during the drain window so the ALB can deregister the task cleanly.
3. Close the DB pool, then exit `0` ("Shutdown complete").
4. If `GRACE_PERIOD_MS` (default 10 000 ms) elapses with requests still in flight, force-close all connections and exit `1` ("Grace period elapsed: force exiting") — ECS marks the task failed, which is visible in service events.

Observe it in logs as: `Shutdown initiated: stopping new connections` → `In-flight requests drained` → `Shutdown complete`. If you see `Grace period elapsed: force exiting`, either a long generation exceeded the drain window (raise `GRACE_PERIOD_MS`) or a connection is stuck (investigate via `database` health + pool timeouts, `database-readiness.md` §3).

---

## 9. Operational runbook (quick)

| Symptom | First check |
|---|---|
| ALB shows unhealthy | `GET /api/health` → which component is `unhealthy`? DB (`error`), model (`degraded`), or storage (`degraded`) |
| Rate limits hit for everyone | `TRUST_PROXY=false` behind ALB (see `docs/aws/networking.md` §6) |
| Generation slow / tokens growing | `TotalTokens` + `PromptTokens` CloudWatch metric, `context_window_used` telemetry column |
| Can't trace a failed generation | Filter logs by `requestId`; check `generation_telemetry.status = 'failure'` + `error_category` |
