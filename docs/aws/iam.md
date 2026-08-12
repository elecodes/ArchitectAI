# ArchitectAI on AWS — Least-Privilege IAM

All AWS features in ArchitectAI are **pay-per-use service calls** (Bedrock, S3, CloudWatch). There is no provisioned compute, so the IAM policy can be extremely narrow. The principle is: **allow only the exact API calls the application makes, scoped to the exact resources it uses.**

This document is the current, Sprint 8-refined version. Changes vs. Sprint 7: Bedrock policy now pins the **exact two model ARNs** the app can invoke (with an optional `bedrock:ModelId` condition), the S3 statement is scoped to **one bucket and one prefix**, the CloudWatch statement keeps `Resource: "*"` (explained below), and there is a new section on ECS/Fargate **task roles vs. EC2 instance profiles**.

---

## 1. Services and the API calls they make

| Service | Calls made by ArchitectAI | Notes |
|---|---|---|
| Bedrock | `bedrock:InvokeModel` | Claude generation + Titan embeddings (same action) |
| S3 | `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` | Export packages under the configured prefix; health probe `listObjects('health/')` uses the same prefix |
| CloudWatch Metrics | `cloudwatch:PutMetricData` | One batch of 10 metrics per generation (only when `CLOUDWATCH_ENABLED=true`) |
| CloudWatch Logs | `logs:CreateLogStream`, `logs:PutLogEvents` | Only when the Docker `awslogs` driver is used in ECS/EKS — no app code path |

No other permissions are needed. In particular, **no** `iam:*`, `s3:DeleteObject` (the app never deletes), `bedrock:InvokeModelWithResponseStream` (no streaming), or `kms:*` (SSE-S3 uses S3-managed keys).

---

## 2. Managed vs inline

- Prefer **inline policies on a dedicated role** scoped to a single bucket and a single model set.
- Do **not** attach broad managed policies like `AmazonS3FullAccess` or `AmazonBedrockFullAccess`.
- If you must use a managed policy, the minimum compatible set is the union of the statements below as an inline/customer-managed policy.

---

## 3. Example policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": [
        "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0",
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1"
      ],
      "Condition": {
        "StringEquals": {
          "bedrock:ModelId": [
            "anthropic.claude-3-5-sonnet-20240620-v1:0",
            "amazon.titan-embed-text-v1"
          ]
        }
      }
    },
    {
      "Sid": "S3Exports",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::architectai-exports/architectai/*"
    },
    {
      "Sid": "S3ListPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::architectai-exports",
      "Condition": {
        "StringLike": { "s3:prefix": "architectai/*" }
      }
    },
    {
      "Sid": "CloudWatchPutMetrics",
      "Effect": "Allow",
      "Action": ["cloudwatch:PutMetricData"],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogsDriver",
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:123456789012:log-group:/architectai/api:*"
    }
  ]
}
```

Notes on the policy:

- **Bedrock model ARNs** — the app invokes exactly two foundation models: `anthropic.claude-3-5-sonnet-20240620-v1:0` (generation) and `amazon.titan-embed-text-v1` (embeddings, the config default). The `Region` segment is empty for foundation-model ARNs (`arn:aws:bedrock:us-east-1::foundation-model/...`). Adjust the list if you enable additional models — grant only models you actually use.
  - The `bedrock:ModelId` condition is **defense-in-depth only**. The reliable, documented mechanism is resource-ARN scoping; AWS guidance (Prescriptive Guidance "Data perimeter for Amazon Bedrock") shows `bedrock:ModelId` in conditions, but scoping `Resource` to the model ARNs is what guarantees the allow. Keep both.
  - **If you opt into Titan v2** (`BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0`): the model id **must include the `:0` suffix** (the default v1 id is `amazon.titan-embed-text-v1`, no suffix). Add the v2 ARN (`.../amazon.titan-embed-text-v2:0`) to the `Resource` list and the `bedrock:ModelId` condition, and set `BEDROCK_EMBEDDING_DIMENSIONS` to 256/512/1024.
- **`cloudwatch:PutMetricData`** cannot be resource-scoped — it is `Resource: "*"` by design. It is a low-risk write-only action (cannot read or delete).
- **CloudWatch Logs statement** — only needed when the task uses the Docker `awslogs` driver. It belongs on the **execution role**, not the task role: on Fargate/ECS the agent that ships container stdout to CloudWatch Logs authenticates as the execution role. Scope it to the log group (and optionally a stream prefix, e.g. `/architectai/api:app-*`). The application never writes logs via the SDK; this covers the container runtime only.
- **S3 resource** — grant only the `architectai/` prefix inside a **dedicated** export bucket. `ListBucket` is needed because `GET latest` lists keys to find the newest object, and the health probe lists the `health/` key under the same prefix. SSE-S3 (`AES256`, the app's default in `s3-store.ts`) uses S3-managed keys, so **no `kms:*` permission and no KMS key** are required — the data is encrypted at rest at no extra cost.

---

## 4. Credential handling rules

1. **Never commit AWS access keys** to the repository (`.env`, code, or CI).
2. The application **never reads keys from its own config** — it uses the SDK default credential provider chain. See `docs/aws/secrets.md`.
3. In Docker Compose for local experimentation, temporary credentials can be passed as env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) — treat them like any secret; do not commit them.
4. In deployed environments, use an **IAM role** so the application never holds static keys at all.
5. Prefer `AWS_REGION` over per-service region config when a single region is used; the app falls back to the SDK chain for region too.

---

## 5. ECS/Fargate task role vs. EC2 instance profile

When ArchitectAI runs on ECS (see `docs/aws/networking.md`), the app resolves credentials through the SDK default chain, which reads the **task role** from the task metadata endpoint.

| Mechanism | Where it's used | Blast radius | Recommendation |
|---|---|---|---|
| **ECS task role** | Fargate / ECS EC2 | Per-task — only that task gets Bedrock/S3/CloudWatch | ✅ **Use this.** Attach the policy in §3 to the task role and reference it as `taskDefinition.taskRoleArn` |
| EC2 instance profile | Standalone EC2 (or ECS EC2 instances themselves) | Per-instance — every container on the host shares it | Only for legacy EC2 deployments; prefer task role |
| EKS IRSA | Kubernetes pods | Per-service-account | Equivalent pattern if running on EKS |

- **Task role (`taskRoleArn`)** — the role the **application** assumes (what `BedrockClient` uses). This is the policy above.
- **Execution role (`executionRoleArn`)** — a separate role the **ECS/Fargate agent** uses to pull the image, read secrets, and ship logs. It needs `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage`, `ecr:BatchCheckLayerAvailability`, `secretsmanager:GetSecretValue` (if using `secrets:` — see `docs/aws/secrets.md`), and the `logs:CreateLogStream` + `logs:PutLogEvents` statement above (if using `awslogs`). Keep the two roles separate; they are independent privilege boundaries.

Example: a Fargate service whose task role has the policy in §3 and an execution role limited to ECR + Secrets Manager + CloudWatch Logs (`awslogs`).

---

## 6. Verification

### 6.1 `aws iam simulate-principal-policy` (no AWS account cost)

Simulate the exact calls the app makes against the role and policy:

```bash
# Simulate Bedrock invoke for both model ARNs
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/architectai-task \
  --action-names bedrock:InvokeModel \
  --resource-arns \
    arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0 \
    arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1

# Simulate S3 operations
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/architectai-task \
  --action-names s3:PutObject s3:GetObject s3:ListBucket \
  --resource-arns arn:aws:s3:::architectai-exports arn:aws:s3:::architectai-exports/architectai/pkg.zip

# Simulate CloudWatch
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/architectai-task \
  --action-names cloudwatch:PutMetricData
```

Every `EvalDecision` should be `allowed`; anything `explicitDeny`/`implicitDeny` for a required action means the policy is too narrow. To prove an allow is **minimal**, run the same simulations with a model ARN the app should NOT reach (e.g. `anthropic.claude-3-7-sonnet-20250219-v1:0`) and confirm it is denied.

### 6.2 IAM Access Analyzer

- Enable **IAM Access Analyzer** on the account, and review **policy findings** for the role: it flags policies that are overly permissive (e.g. `Resource: "*"` where scoping is possible). `cloudwatch:PutMetricData` on `*` is a documented false-positive; keep a comment in the policy.
- Access Analyzer can also **generate a policy** from CloudTrail: after a real Bedrock/S3 run, `aws accessanalyzer create-access-preview`/`start-policy-generation` returns the minimal policy for the actions actually used. Useful after the first week in production.

---

## 7. Verification checklist

- [ ] Policy contains only the statements above — nothing broader
- [ ] Bedrock statement pins exactly the two model ARNs (`anthropic.claude-3-5-sonnet-20240620-v1:0`, `amazon.titan-embed-text-v1`) + optional `bedrock:ModelId` condition
- [ ] S3 statements scoped to the dedicated export bucket and `architectai/` prefix
- [ ] No `s3:DeleteObject`, no `iam:*`, no `kms:*`, no `bedrock:InvokeModelWithResponseStream`
- [ ] No access keys in the repository or image
- [ ] ECS uses a **task role** (policy above) separate from the **execution role** (ECR + secrets only)
- [ ] `aws iam simulate-principal-policy` returns `allowed` for all required actions and `denied` for a non-approved model
- [ ] IAM Access Analyzer enabled; `cloudwatch:PutMetricData` `*` understood as unavoidable
