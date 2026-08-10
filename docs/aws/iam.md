# ArchitectAI on AWS — Least-Privilege IAM

All AWS features in ArchitectAI are **pay-per-use service calls** (Bedrock, S3, CloudWatch). There is no provisioned compute, so the IAM policy can be extremely narrow. The principle is: **allow only the exact API calls the application makes, scoped to the exact resources it uses.**

---

## 1. Services and the API calls they make

| Service | Calls made by ArchitectAI | Notes |
|---|---|---|
| Bedrock | `bedrock:InvokeModel` | Claude generation + Titan embeddings (same action) |
| S3 | `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` | Export packages under the configured prefix |
| CloudWatch | `cloudwatch:PutMetricData` | One call per generation (only when enabled) |

No other permissions are needed. In particular, **no** `iam:*`, `s3:DeleteObject` (the app never deletes), `bedrock:InvokeModelWithResponseStream` (no streaming), or `kms:*` (SSE-S3 uses S3-managed keys).

---

## 2. Managed vs inline

- Prefer **inline policies on a dedicated role** scoped to a single bucket and a single model set.
- Do **not** attach broad managed policies like `AmazonS3FullAccess` or `AmazonBedrockFullAccess`.
- If you must use a managed policy, the minimum compatible set is the union of the three statements below as an inline/customer-managed policy.

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
        "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2"
      ]
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
    }
  ]
}
```

Notes on the policy:

- **Model ARNs** — the `Region` segment is empty for Bedrock model ARNs. Adjust the ARN list if you enable additional models (only grant models you actually use).
- **`cloudwatch:PutMetricData`** cannot be resource-scoped — it is `Resource: "*"` by design. It is a low-risk write-only action (cannot read or delete).
- **S3 resource** — grant only the `architectai/` prefix inside a **dedicated** export bucket. `ListBucket` is needed because `GET latest` lists keys to find the newest object.

---

## 4. Credential handling rules

1. **Never commit AWS access keys** to the repository (`.env`, code, or CI).
2. The application **never reads keys from its own config** — it uses the SDK default credential provider chain.
3. In Docker Compose for local experimentation, temporary credentials can be passed as env vars (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`) — treat them like any secret; do not commit them.
4. In deployed environments, use an **IAM role** (ECS task role / EC2 instance profile / EKS IRSA) so the application never holds static keys at all.
5. Prefer `AWS_REGION` over per-service region config when a single region is used; the app falls back to the SDK chain for region too.

---

## 5. Verification checklist

- [ ] Policy contains only the four statements above — nothing broader
- [ ] S3 statements scoped to the dedicated export bucket and `architectai/` prefix
- [ ] No `s3:DeleteObject`, no `iam:*`, no `kms:*`, no `bedrock:InvokeModelWithResponseStream`
- [ ] No access keys in the repository or image
- [ ] `aws iam simulate-principal-policy` passes against the policy and the required actions
