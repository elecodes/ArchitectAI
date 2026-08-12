# ArchitectAI on AWS — Cost Control

Consolidated and Sprint 8-extended cost controls. This document **extends** — it does not replace — `docs/aws/cost-safety.md` (budgets, per-integration guardrails, cleanup, verification checklist). Read `cost-safety.md` first; this doc adds the controls that now exist **in code**, the **embedding-index sizing** math, and the exact CLI/JSON for budgets, S3 lifecycle, and log retention.

> ⚠️ Cost-safety's warning still stands: **a prior developer incurred unexpected AWS charges on another project. Do not assume free-tier guarantees.**

---

## 1. Budgets — CLI (before enabling anything)

`cost-safety.md` §2 shows 50/85/100% ACTUAL alerts. The Sprint 8 recommendation: add a **FORECASTED** alert at **80%** (forecast catches runaway *before* the month ends) and deliver via **SNS** so it can fan out to Slack/email.

```bash
# 1. Create an SNS topic (one-time)
aws sns create-topic --name architectai-cost-alerts          # -> TopicArn

# 2. Subscribe (email or your ops channel)
aws sns subscribe --topic-arn arn:aws:sns:us-east-1:123456789012:architectai-cost-alerts \
  --protocol email --notification-endpoint you@example.com

# 3. Create the budget: $10/month, ACTUAL + FORECASTED @ 80%, SNS subscriber
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "architectai-monthly",
    "BudgetLimit": { "Amount": "10", "Unit": "USD" },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST",
    "CostFilters": {},
    "PlannedBudgetLimits": {}
  }' \
  --notifications-with-subscribers '[
    { "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 80, "ThresholdType": "PERCENTAGE" },
      "Subscribers": [{ "SubscriptionType": "SNS", "Address": "arn:aws:sns:us-east-1:123456789012:architectai-cost-alerts" }] },
    { "Notification": { "NotificationType": "FORECASTED", "ComparisonOperator": "GREATER_THAN", "Threshold": 80, "ThresholdType": "PERCENTAGE" },
      "Subscribers": [{ "SubscriptionType": "SNS", "Address": "arn:aws:sns:us-east-1:123456789012:architectai-cost-alerts" }] }
  ]'

# 4. Verify
aws budgets describe-budget --account-id 123456789012 --budget-name architectai-monthly
```

Also enable **AWS Cost Anomaly Detection** (`aws ce create-anomaly-monitor` or the console) and tag the export bucket with a cost-allocation tag (`Project=ArchitectAI`), per `cost-safety.md` §2.

---

## 2. In-app cost controls (now in code — Sprint 8)

| Control | Config | In code | Enforced where |
|---|---|---|---|
| General rate limit 100/min | `RATE_LIMIT_GENERAL` (default 100) | `src/api/middleware/rate-limiter.ts` | All `/api` routes |
| **Generation rate limit 10/min** | `RATE_LIMIT_GENERATION` (default 10) | `generationLimiter` | The 6 generation endpoints (`/api/specs`, `/api/architecture`, `/api/tasks`, `/api/vision`, `/api/risks`, `/api/diagrams`) |
| **Export rate limit 10/min** | `RATE_LIMIT_EXPORT` (default 10) | `exportLimiter` | `POST /api/export/:projectId` |
| **Index rate limit 5/min** | `RATE_LIMIT_INDEX` (default 5) | `indexLimiter` | `POST /api/projects/:id/index` — the embedding-cost endpoint |
| **Index file cap** | `MAX_INDEX_FILES` (default 500) | `src/config/index.ts` → `RAGIndexer.indexProject` | `/api/projects/:id/index` — hard upper bound on chunks per index run |
| Output cap | — (fixed 4096) | all generation generators (`maxTokens: 4096`) + provider defaults | Each generation |
| Retry bound | — (≤2 attempts) | `src/generation/retry.ts` | A failed parse costs **at most one** retry |
| Context budget | `LLM_CONTEXT_WINDOW` (default 128000) | context-window manager | Bounds input tokens per request |
| CloudWatch sink | `CLOUDWATCH_ENABLED` (**default OFF**) | `cloudwatch-sink.ts` | No metrics sent unless explicitly enabled |

Note: the rate-limit env vars (`RATE_LIMIT_GENERAL/GENERATION/EXPORT/INDEX`) are read directly by the limiter module — they are **not** part of the zod config schema, so a typo falls back to the defaults silently. Validate them in the task definition.

---

## 3. Embedding index sizing — the quiet-bleed, quantified

This is the single most important new section. Indexing a repository through `/api/projects/:id/index` calls the embedding model **once per ≤512-token chunk** (`src/rag/indexer.ts` → `chunkText(content, 512)` → `embed(chunk)`).

### 3.1 Pricing

**Amazon Titan Text Embeddings (`amazon.titan-embed-text-v1` default, `amazon.titan-embed-text-v2:0` opt-in): $0.02 per 1M tokens** ($0.00002 per 1K tokens, on-demand). Billed on tokens processed, not per call. (Check `https://aws.amazon.com/bedrock/pricing/` for current prices.)

### 3.2 Worked example — a 50k-file repository

| Input | Value |
|---|---|
| Files | 50,000 |
| Average file size | ~408 chars (~102 tokens, `estimateTokens = ceil(chars/4)`) |
| Total tokens | ~50,000 × 102 ≈ **5.1M tokens** |
| Chunks (≤512 tokens each) | ~5.1M / 512 ≈ **10,000 chunks = 10,000 Titan calls** |
| **Embedding cost** | 5.1M × $0.02/1M ≈ **$0.10** |
| Rows inserted | ~10,000 in `indexed_chunks` (pgvector, negligible S3/DB cost) |

**One re-index per day** on that repo ≈ **$3/mo**; per week ≈ $0.40/mo. The cost driver is **how often you re-index**, not the one-off index. A 500k-file monorepo scales linearly: ~51M tokens → ~100k chunks → **~$1.02 per full index**.

### 3.3 The `MAX_INDEX_FILES` interplay — read this

The default **`MAX_INDEX_FILES=500` caps the parser at 500 files**, so a 50k-file repo indexes only 500 files (~51k tokens, ~100 chunks, **~$0.001**) unless you raise `MAX_INDEX_FILES`. Both numbers are correct: the cap is a built-in cost brake **and** a correctness limiter (a big repo silently gets partial coverage). Raise it deliberately, in line with the 5/min index rate limit.

### 3.4 Why this is real now (and wasn't before)

Before Sprint 8, `BedrockClient.embed()` sent only `{ inputText }`, so Titan returned its default **1024**-dimension vector (v2) while the DB column is `vector(1536)` (`004-indexed-chunks.sql`). Every insert failed; the indexer swallowed per-chunk errors and logged a warning, so indexing "completed" with **zero chunks** — while still **billing every wasted Titan call**. Sprint 8 fixed the contract: the **default embedding model is now Titan v1 (`amazon.titan-embed-text-v1`)**, which outputs 1536 dimensions natively — matching the column with no migration and no `dimensions` field, so indexing actually persists now.

> **If you opt into Titan V2** (`BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0`): it accepts `dimensions` of only **256 / 512 / 1024** — the config schema **rejects** 1536 with a v2 model. You must set `BEDROCK_EMBEDDING_DIMENSIONS` to 1024/512/256 **and** align the column (`ALTER TABLE indexed_chunks ALTER COLUMN embedding TYPE vector(1024)` + recreate the HNSW index). See `docs/aws/database-readiness.md` §5. Smaller vectors also mean cheaper pgvector storage (512 dims keeps ~99% of the accuracy of 1024).

---

## 4. S3 lifecycle (manual — exact CLI)

Storage is only the export zips under the `architectai/` prefix. **Lifecycle is a manual AWS step — the app has no in-code retention.** Extend `cost-safety.md` §3 with a two-stage rule: transition to **Glacier Flexible Retrieval after 90 days**, expire after **365 days**:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket architectai-exports \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "architectai-exports-lifecycle",
      "Status": "Enabled",
      "Filter": { "Prefix": "architectai/" },
      "Transitions": [
        { "Days": 90, "StorageClass": "GLACIER" }
      ],
      "Expiration": { "Days": 365 }
    }]
  }'

# Verify
aws s3api get-bucket-lifecycle-configuration --bucket architectai-exports
```

Retention is **still manual**: nothing deletes or transitions automatically until this rule exists, and daily-dated zips accumulate otherwise. Keep the bucket dedicated (`aws s3 rb --force` cleans it completely, per `cost-safety.md`).

---

## 5. CloudWatch — logs retention + metrics free tier

```bash
# Logs: unlimited by default -> cap at 14 days
aws logs put-retention-policy --log-group-name /architectai/api --retention-in-days 14
```

- **CloudWatch Logs:** billed on ingested + stored bytes. With 14-day retention the cost is negligible for this app's log volume. Re-apply the policy after recreating the log group.
- **CloudWatch Metrics:** custom metrics bill per **unique metric** (namespace + metric name + dimensions), **first 10,000 free**, then ~$0.30/metric/month; `PutMetricData` API requests are billed separately (first 1M free, then $0.01/1K). The sink emits a fixed set of **10 distinct metrics** — even a saturated month (43k generations) is still 10 unique metrics, so this stays inside the free tier. The practical risk was logs, not metrics (see `cost-safety.md` §3).

---

## 6. Monthly worst-case table

Worst case assumes a saturated box: generation limit 10/min × ~43k min/month = up to ~43k generations (in practice a single user won't saturate; this is the ceiling the app's own limits allow).

| Service | Charge source | Free-tier note | Sprint 8 worst case (very pessimistic) | Existing safeguards |
|---|---|---|---|---|
| Bedrock generation | per 1K tokens | none guaranteed (`cost-safety.md`) | 10/min × avg ~5K tokens/gen ≈ 2.5B tokens/mo → **thousands of $** | 10/min limit, `maxTokens` 4096, retry ≤2, context budget |
| Bedrock embeddings | per 1M tokens | very low | Full 50k-file re-index 2×/day ≈ **$6/mo** | `MAX_INDEX_FILES`, 5/min index limit, **sizing math (§3)** |
| S3 | GB-month + per 1K requests | ~5 GB tier | Zips at ~$0.023/GB + trivial request cost → **<$1/mo** | prefix-scoped IAM, SSE-S3, lifecycle (manual) |
| CloudWatch metrics | per unique metric (10 distinct) + `PutMetricData` API calls | first 10,000 custom metrics/mo free | 43k gens/mo = still 10 unique metrics → **$0** (free tier) + trivial API-request cost | opt-in OFF, fire-and-forget, low-cardinality dims |
| CloudWatch logs | ingest + storage | — | verbose pino info logs, 14d retention → **<$5/mo** | retention policy (manual), S9 redaction pending |

Bottom line: **the dominant and only real cost lever is generation volume.** The in-app 10/min generation cap is the ceiling; budgets (forecast @ 80%) are the tripwire; `generation_telemetry` token columns are the measurement. Embedding indexing is now real money but cheap by design — the sizing math in §3 turns "very low" into a number you can defend.

---

## 7. Related

- `docs/aws/cost-safety.md` — budgets, cleanup, verification checklist (this doc extends it)
- `docs/aws/observability.md` — what CloudWatch receives and retention
- `docs/aws/database-readiness.md` — the `vector(1536)` ↔ embedding-dimension contract
- `docs/sprint8-audit.md` — the cost-risk table this sprint closed
