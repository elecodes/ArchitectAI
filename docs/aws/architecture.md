# ArchitectAI on AWS — Architecture

Sprint 7 (v1.3.0) makes Amazon Web Services integrations **optional and opt-in**. The application remains **local-first**: it runs entirely in Docker Compose with zero AWS credentials or services and no changes to the default experience. This document describes the two operational modes and what lives in each.

---

## 1. Two modes

### Local mode (default, no AWS)

Everything runs on the developer machine via Docker Compose:

- React frontend + Express backend (single container)
- PostgreSQL with pgvector (Postgres container)
- LLM via OpenRouter / OpenAI / Ollama / mock — whichever is configured
- Artifact storage on the local filesystem (`STORAGE_PROVIDER=local`, default `./data/storage`)
- Telemetry written to Postgres `generation_telemetry` and to stdout as JSON logs

**No AWS account, no AWS credentials, no network egress to AWS.** The AWS SDK packages are installed but only loaded when an AWS feature is enabled.

### AWS mode (opt-in)

AWS mode enables one or more of three independent capabilities. Each is toggled by environment variables; none is required for the others to work.

| Capability | Env switch | Default |
|---|---|---|
| Bedrock LLM + embeddings | `LLM_PROVIDER=bedrock` / `EMBEDDING_PROVIDER=bedrock` | off |
| S3 artifact storage | `STORAGE_PROVIDER=s3` (+ `S3_BUCKET`) | off |
| CloudWatch telemetry | `CLOUDWATCH_ENABLED=true` | off |

A typical hybrid setup: keep the app local but point `LLM_PROVIDER=bedrock` for cloud inference, `STORAGE_PROVIDER=local` for artifacts, and no CloudWatch. All combinations are valid.

---

## 2. What was added

### 2.1 AWS Bedrock (LLM + embeddings)

- `src/llm/providers/bedrock.ts` — `BedrockClient implements LLMClient`
- `complete()` uses the Claude **Messages** API (`anthropic.claude-3-5-sonnet-20240620-v1:0` by default)
- `embed()` uses Amazon Titan (`amazon.titan-embed-text-v2` by default)
- `isHealthy()` resolves credentials via the SDK default provider chain **without making a billed API call** — a cheap config-resolution check
- Factory: `LLM_PROVIDER=bedrock` and `EMBEDDING_PROVIDER=bedrock` are wired in `src/llm/factory.ts`

**Credentials** are resolved through the AWS SDK **default credential provider chain** — never from the application config. The chain looks up, in order: env vars (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`), shared credentials file, ECS/EC2 instance roles, SSO, etc. In deployed environments prefer **IAM roles** (Instance Profile) over access keys.

### 2.2 S3 artifact storage

- `src/storage/document-store.ts` — `DocumentStore` interface (`put`/`get`/`delete`/`list`)
- `src/storage/local-store.ts` — default filesystem store (with path-traversal guard)
- `src/storage/s3-store.ts` — S3 store, SSE-S3 (AES256) encryption, configurable key prefix
- `src/storage/factory.ts` — `createDocumentStore(config)` switches on `STORAGE_PROVIDER`
- `src/storage/export-service.ts` — server-side engineering-package builder (zip)
- `src/api/routes/export.ts` — `POST /api/export/:projectId` (assemble + store) and `GET /api/export/:projectId/latest` (download last package)

The frontend exposes "Save to storage" and "Download stored" actions on the Generate page when a pipeline completes. The stored package is the same engineering `.zip` that was already downloadable, now persisted on the configured provider.

### 2.3 CloudWatch telemetry

- `src/telemetry/cloudwatch-sink.ts` — optional `PutMetricData` emitter, **off by default**
- 10 metrics per generation (`GenerationDuration`, `TotalDuration`, `PromptTokens`, `CompletionTokens`, `TotalTokens`, `RetrievedChunks`, `FittedChunks`, `ContextWindowUsed`, `EmbeddingDuration`, `RetrievalDuration`) with dimensions `Module`, `Model`, `Provider`, `Status`
- The SDK client is **dynamically imported** so a local run with `CLOUDWATCH_ENABLED=false` never initializes it
- The sink is fire-and-forget: a CloudWatch failure never fails or slows a generation

**Logs**: ArchitectAI continues to write pino JSON to stdout (ADR-0012). In a deployed container this is shipped to CloudWatch Logs with the Docker **`awslogs` log driver** — zero application code changes:

```yaml
services:
  api:
    logging:
      driver: awslogs
      options:
        awslogs-group: /architectai/api
        awslogs-region: us-east-1
        awslogs-stream-prefix: app
```

### 2.4 Telemetry model

- `src/db/migrations/008-telemetry-provider.sql` — additive `ALTER TABLE generation_telemetry ADD COLUMN provider`
- All six generation endpoints (`spec`, `architecture`, `tasks`, `vision`, `risks`, `diagrams`) record a telemetry row via `GenerationTracker` (success and failure paths), and fan out to the CloudWatch sink when enabled

---

## 3. Env reference (AWS)

```env
# --- AWS Bedrock (optional) ---
LLM_PROVIDER=openrouter            # add 'bedrock'
LLM_MODEL=anthropic/claude-3-5-sonnet-20240620-v1:0
BEDROCK_MODEL=anthropic.claude-3-5-sonnet-20240620-v1:0
BEDROCK_REGION=us-east-1
BEDROCK_TIMEOUT_MS=60000

EMBEDDING_PROVIDER=openai          # add 'bedrock'
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2

# --- S3 storage (optional) ---
STORAGE_PROVIDER=local             # local | s3
STORAGE_LOCAL_DIR=./data/storage
S3_BUCKET=                         # required when STORAGE_PROVIDER=s3
S3_REGION=us-east-1
S3_PREFIX=architectai

# --- CloudWatch telemetry (optional) ---
CLOUDWATCH_ENABLED=false           # 'true' | 'false'
CLOUDWATCH_REGION=us-east-1
CLOUDWATCH_METRICS_NAMESPACE=ArchitectAI
```

AWS credentials are **not** configured here — they come from the SDK default credential provider chain (see `docs/aws/iam.md`).

---

## 4. What is intentionally NOT in scope

Sprint 7 deliberately does **not** provision or require any of these (see ADR-0015):

- RDS / Aurora — Postgres stays local for now
- ECS / Fargate, ECR, ALB, Route 53, auto-scaling
- Secrets Manager — env vars remain the mechanism
- Terraform / CDK — no infrastructure-as-code yet
- CloudWatch Logs is optional via the Docker `awslogs` driver (no code change)

These remain in the roadmap under **v2.0.0 — AWS Deployment**. See `ROADMAP.md`.

---

## 5. Related documents

- `docs/aws/iam.md` — least-privilege IAM policy for the three services
- `docs/aws/cost-safety.md` — budgets, cleanup, verification
- `docs/adr/0015-optional-aws-integrations.md` — the decision record
