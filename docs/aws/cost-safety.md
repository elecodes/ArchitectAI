# ArchitectAI on AWS — Cost Safety

ArchitectAI's AWS integration is **pay-per-use only** — it provisions no compute, storage, or managed services. This keeps the blast radius small, but the three integrations still bill per call, so runaway usage is the risk to manage.

> ⚠️ A prior developer incurred **unexpected AWS charges** on another project. Read this before enabling AWS mode. **Do not assume free-tier guarantees.**

---

## 1. What costs what

| Capability | Billing unit | Typical magnitude |
|---|---|---|
| Bedrock Claude (generation) | per 1K tokens (input + output) | cheapest-tier Claude ~$0.0008/1K input, ~$0.004/1K output |
| Bedrock Titan (embeddings) | per 1M tokens | very low |
| S3 storage | per GB-month + per 1K PUT/GET | tiny (zipped packages, rarely read) |
| CloudWatch PutMetricData | per 1K metric data points | low; one batch (10 metrics) per generation |

Because every generation makes at least one Bedrock call, **token volume is the dominant variable**. The app already mitigates this:

- **Rate limiting** on generation endpoints (10 req/min, ADR-0014 / LLM04)
- **Context Window Manager** budgets tokens per request (`LLM_CONTEXT_WINDOW`)
- **Validation + bounded retry** — a failed parse costs one retry at most (2 total attempts)
- Telemetry records token usage per generation in `generation_telemetry`, so you can measure actual spend

---

## 2. Budget alarm (recommended, before enabling)

Set up **AWS Budgets** with alerts at 50% / 85% / 100% of a conservative monthly amount, and enable **AWS Cost Anomaly Detection**:

```bash
# Example — monthly budget of $10 with alerts
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "architectai-monthly",
    "BudgetLimit": { "Amount": "10", "Unit": "USD" },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[
    { "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 50 },
      "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "you@example.com" }] },
    { "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 85 },
      "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "you@example.com" }] },
    { "Notification": { "NotificationType": "ACTUAL", "ComparisonOperator": "GREATER_THAN", "Threshold": 100 },
      "Subscribers": [{ "SubscriptionType": "EMAIL", "Address": "you@example.com" }] }
  ]'
```

Costs can be attributed per workspace with a **Cost Allocation Tag** (e.g. `Project=ArchitectAI`) on the export bucket and any resources created.

---

## 3. Per-integration guardrails

### Bedrock

- Use the **cheapest model that meets quality needs**. Model choice dominates spend (Claude Sonnet vs a smaller model).
- Keep `LLM_CONTEXT_WINDOW` realistic (128000 default). Larger budgets = more input tokens = more cost.
- The `mock` provider remains the way to iterate UI/pipeline without any model cost.

### S3

- Store only the engineering-package zips (the `architectai/` prefix).
- Add a **lifecycle rule** to expire old packages (e.g. retain 90 days) so storage does not grow unbounded:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket architectai-exports \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-exports",
      "Status": "Enabled",
      "Prefix": "architectai/",
      "Expiration": { "Days": 90 }
    }]
  }'
```

- Consider setting the bucket to be **removable**: don't put other resources in the same account, so `aws s3 rb --force` cleans it completely.

### CloudWatch

- `PutMetricData` cost scales with the number of generations — low in practice.
- If logs are shipped via the `awslogs` driver, check **log group retention** (defaults are unlimited/forever). Set a retention policy, e.g. 14 days:

```bash
aws logs put-retention-policy --log-group-name /architectai/api --retention-in-days 14
```

---

## 4. Shutting it off / cleanup

Disable each integration independently — no code changes required:

| Capability | How to turn off |
|---|---|
| Bedrock | `LLM_PROVIDER=openrouter` (or `mock`), `EMBEDDING_PROVIDER=openai` |
| S3 | `STORAGE_PROVIDER=local` |
| CloudWatch | `CLOUDWATCH_ENABLED=false` |

To remove AWS resources entirely:

```bash
# Empty and delete the export bucket
aws s3 rb s3://architectai-exports --force

# Delete the log group (after removing the awslogs driver from compose)
aws logs delete-log-group --log-group-name /architectai/api

# Remove budgets / anomaly monitors
aws budgets delete-budget --account-id 123456789012 --budget-name architectai-monthly
```

Verify with **Cost Explorer** that the account shows $0 after cleanup.

---

## 5. Verification checklist

- [ ] AWS Budgets (50/85/100%) + Cost Anomaly Detection created **before** enabling any integration
- [ ] IAM role uses the least-privilege policy from `docs/aws/iam.md` (no broad admin/full-access)
- [ ] S3 lifecycle rule expires old export packages
- [ ] CloudWatch log group has a retention policy
- [ ] `STORAGE_PROVIDER`, `LLM_PROVIDER`, `EMBEDDING_PROVIDER`, `CLOUDWATCH_ENABLED` default to the off/local values in `.env.example`
- [ ] Cleanup steps (above) verified against a test account
