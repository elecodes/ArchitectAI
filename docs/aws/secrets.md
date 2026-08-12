# ArchitectAI on AWS — Secrets & Secrets Lifecycle

This document covers every secret the application touches, how each is validated at boot, how they should be stored and rotated in AWS, and the repository hygiene that keeps them out of source control. It complements `docs/aws/iam.md` (credentials via roles, not keys) and `docs/aws/database-readiness.md` (RDS credential handling).

---

## 1. Secrets inventory

| Secret | Read by | Where it lives | Rotation model |
|---|---|---|---|
| `JWT_SECRET` | `src/config/index.ts` | App env (or Secrets Manager → ECS `secrets:`) | Manual; invalidates sessions on rotation |
| `LLM_API_KEY` | `src/config/index.ts` → OpenRouter/OpenAI providers | App env | Provider-console rotation |
| `EMBEDDING_API_KEY` | `src/config/index.ts` → embedding providers | App env | Provider-console rotation |
| `DATABASE_URL` | `src/config/index.ts` → `src/db/connection.ts` | App env | Rotate with RDS password; keep `sslmode` |
| `DB_PASSWORD` (local compose) | `docker-compose.yml` | `.env` only | n/a (local) |
| **AWS credentials** | **never** read by app code | SDK default credential chain only | IAM role rotation (no keys) |

**The one rule that governs all of these:** the application never reads AWS credentials from its own configuration or environment. `BedrockClient`, the S3 store, and the CloudWatch sink all resolve credentials via the AWS SDK **default credential provider chain** (env vars → shared credentials file → ECS/EC2/IMDS roles → SSO). AWS access key env vars (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) are *never* part of the config schema and are only honored by the SDK chain — for local experimentation, not production.

---

## 2. The `NODE_ENV=production` gate

`src/config/index.ts` validates every env var through a zod schema (`superRefine`) **before boot**. In `NODE_ENV=production` it hard-rejects:

| Env var | Production gate | Result |
|---|---|---|
| `LLM_PROVIDER` | `mock` is rejected | **Boot fails** — `Configuration validation failed` |
| `EMBEDDING_PROVIDER` | `mock` is rejected | **Boot fails** |
| `JWT_SECRET` | `< 32 chars` OR one of `dev-secret` / `secret` / `changeme` | **Boot fails** |
| `DATABASE_URL` | missing `sslmode` | **Warning only** (does not block) — RDS requires SSL |

The weak-secret list (`WEAK_JWT_SECRETS = ['dev-secret', 'secret', 'changeme']`) complements the schema's placeholder rejection (`dev-secret-change-in-prod`, `changeme`), so the gate is fail-fast: a production container with a weak or mock configuration **will not start**. Treat the `DATABASE_URL` SSL warning as a deploy-blocking manual check until it becomes a hard error.

---

## 3. Storing secrets in AWS

### 3.1 Recommended: AWS Secrets Manager

For a Fargate deployment use **AWS Secrets Manager** for `JWT_SECRET`, `LLM_API_KEY`, `EMBEDDING_API_KEY`, and the RDS password.

**Create the secret (JWT example):**

```bash
JWT=$(openssl rand -base64 48)
aws secretsmanager create-secret \
  --name architectai/jwt-secret \
  --secret-string "$JWT"
```

**ECS `secrets:` syntax** — inject a secret directly as an env var at task start. The ECS **execution role** needs `secretsmanager:GetSecretValue` on the ARN (see `docs/aws/iam.md` §5):

```json
{
  "containerDefinitions": [{
    "name": "api",
    "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/architectai:latest",
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "BEDROCK_MODEL", "value": "anthropic.claude-3-5-sonnet-20240620-v1:0" },
      { "name": "BEDROCK_EMBEDDING_MODEL", "value": "amazon.titan-embed-text-v1" },
      { "name": "TRUST_PROXY", "value": "true" }
    ],
    "secrets": [
      { "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:architectai/jwt-secret" },
      { "name": "LLM_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:architectai/llm-api-key" },
      { "name": "EMBEDDING_API_KEY", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:architectai/embedding-api-key" },
      { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789012:secret:architectai/database-url" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/architectai/api",
        "awslogs-region": "us-east-1",
        "awslogs-stream-prefix": "app"
      }
    }
  }]
}
```

Notes:

- The `secrets:` key is the exact ECS syntax for **key-from-ARN** injection. Each value is `"<env-var-name>"` → `"valueFrom": "<secret ARN>"`. No app code changes — the container sees plain env vars, and the config schema validates them as usual.
- Store `DATABASE_URL` **with** `sslmode=require` baked in (`postgresql://user:pass@host:5432/architectai?sslmode=require`) so the production SSL warning is satisfied by construction.
- The config-schema defaults are **production-safe by construction**: the default embedding model `amazon.titan-embed-text-v1` outputs 1536 dimensions, matching the `vector(1536)` column. Only the **opt-in** Titan v2 path needs explicit pinning (`BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0` + `BEDROCK_EMBEDDING_DIMENSIONS=256/512/1024` + a `vector(1024)` column migration — see `docs/aws/database-readiness.md` §5).

### 3.2 Alternative: plain env var injection

Secrets Manager is the recommendation because it is **rotatable** and **auditable**. For a single-tenant MVP, SSM Parameter Store (`aws ssm put-parameter --type SecureString`) or a hardcoded `environment` block in the task definition also work — the tradeoff is that rotation is manual and values sit in plaintext task definitions. Do **not** bake secrets into the container image at build time; the image must stay rebuildable without credentials.

---

## 4. Rotating `JWT_SECRET`

- **When:** any suspicion of exposure, a team-member change, or a policy window (e.g. every 90 days).
- **How:**

```bash
# 1. Generate a new secret (>= 32 chars, not in WEAK_JWT_SECRETS)
NEW=$(openssl rand -base64 48)
aws secretsmanager put-secret-value --secret-id architectai/jwt-secret --secret-string "$NEW"

# 2. Redeploy the service so new tasks pick it up
aws ecs update-service --cluster architectai --service api --force-new-deployment
```

- **Impact:** all JWTs are signed with the old secret, so **every user is logged out** and must re-authenticate. There is no refresh-token flow (auth is 24h HS256, see `src/api/middleware/auth.ts`). Rotate in a maintenance window.
- **Known defaults to never use in prod:** `dev-secret-change-in-prod`, `changeme`, `dev-secret`, `secret`.

---

## 5. Repository hygiene

| Guard | Status | Detail |
|---|---|---|
| `.env` gitignored | ✅ | `.gitignore` line `.env` |
| `.env.*` (e.g. `.env.production`) gitignored | ❌ **GAP** | `.gitignore` only ignores `.env`, **not** `.env.*`. Add `.env.*` / `!.env.example` (the tracked template) to `.gitignore` and `.dockerignore` |
| Sensitive files blocked from RAG/review indexing | ✅ | `DEFAULT_IGNORE_PATTERNS` in `src/rag/file-parser.ts` (mirrored in `src/review/repository.ts`) skips `.env`, `.env.*`, `*.key`, `*.pem`, `*.p12`, `*.pfx`, `id_rsa`, `id_ed25519`, `secrets.*`, `*.secret`, `credentials.*`, `.aws/`, `.ssh/` — so secrets can never be embedded or leaked by the review/embedding pipeline |
| `.env.example` tracked | ✅ | The committed template holds only safe placeholders; keep it that way |
| AWS keys in image/code | ❌ denied by policy | See `docs/aws/iam.md` §4 |

---

## 6. Verification checklist

- [ ] `.env`, `.env.*`, `data/` are ignored by git; `.env.example` contains only placeholders
- [ ] `NODE_ENV=production` deployment uses `LLM_PROVIDER != mock`, `EMBEDDING_PROVIDER != mock`, `JWT_SECRET >= 32 chars` and not in the known-default list
- [ ] `DATABASE_URL` includes `sslmode=require` in production
- [ ] AWS credentials exist only as an IAM role (task role), never in config or env
- [ ] Secrets live in Secrets Manager; task definition uses `secrets:` key-from-ARN; execution role has `secretsmanager:GetSecretValue`
- [ ] `JWT_SECRET` rotation procedure documented and signed-off (all users will be logged out)
