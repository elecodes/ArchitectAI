# ArchitectAI on AWS — Database Readiness (local Postgres → RDS)

Moving from the local `pgvector/pgvector:pg16` container (`docker-compose.yml`) to Amazon RDS PostgreSQL. Everything here is a **manual, documented runbook** — the app provisions no database (ADR-0015); you create RDS yourself and point `DATABASE_URL` at it.

Current local reality (from `src/db/connection.ts`, `src/db/migrations/*`):

- Pool `max: 10`, `connectionString: DATABASE_URL` — **no** `connectionTimeoutMillis`, `statement_timeout`, idle timeout, or explicit SSL config.
- Migrations 001–008 run **at boot before `listen()`** (`src/index.ts` → `src/db/migrate.ts`), each in a transaction.
- `vector(1536)` + HNSW `vector_cosine_ops` (`004-indexed-chunks.sql`).

---

## 1. pgvector on RDS

RDS PostgreSQL ships pgvector as a **supported extension**. Verify the exact minor before provisioning — the RDS minor you pick determines the available pgvector version:

```bash
# All Postgres 16 minors available in your region
aws rds describe-db-engine-versions \
  --engine postgres \
  --engine-version 16 \
  --query "DBEngineVersions[].{EngineVersion:EngineVersion,Features:SupportedFeatureNames}" \
  --output table

# Confirm pgvector is in the supported features for the minor you chose
aws rds describe-db-engine-versions \
  --engine postgres --engine-version 16.8 \
  --query "DBEngineVersions[0].SupportedFeatureNames"
```

The app only needs two extensions (`001-extensions-and-users.sql`): `pgcrypto` (UUIDs) and `vector`. Both are enabled via `CREATE EXTENSION IF NOT EXISTS`, which on RDS requires the **`rds_superuser`** role — grant it to the migration user or run boot migrations as the RDS master user (see §4).

---

## 2. SSL — `sslmode` is mandatory

RDS enforces SSL for non-VPC-reachable connections. `DATABASE_URL` must carry `sslmode`:

```bash
postgresql://architect:<password>@<rds-endpoint>:5432/architectai?sslmode=require
```

- `pg` 8.13.1 (installed) **honors `sslmode` in the connection string** (supported since 8.11) — no code change needed to get TLS from the driver.
- The `NODE_ENV=production` gate (`src/config/index.ts`) **warns** when `DATABASE_URL` lacks `sslmode` ("Amazon RDS requires SSL in production"). It is a warning, not a hard failure — treat it as deploy-blocking and fix it in the secret, not at deploy time (store the full URL with `sslmode=require` in Secrets Manager; see `docs/aws/secrets.md` §3).
- For `sslmode=verify-full` (recommended beyond MVP) also pin the RDS CA bundle (`rds-ca-rsa2048-g1.pem`) and set `sslrootcert` in the URL — supported by `pg`.

---

## 3. Pool tuning (recommendations — not yet in code)

The pool today (`src/db/connection.ts`) is bare: `max: 10` and nothing else. For RDS over a network, add timeouts. This is a **recommended change**, not shipped:

```ts
const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,                    // today: 10 — fine for single-user/1 task
  connectionTimeoutMillis: 5_000,   // fail fast if RDS is unreachable
  idleTimeoutMillis: 30_000,
  allowExitOnIdle: false,
  options: '-c statement_timeout=30000',  // bound the longest query (incl. indexing + HNSW)
});
```

| Parameter | Today | Recommendation | Why |
|---|---|---|---|
| `max` | 10 | keep 10 (1 task × 1 replica) | Matches Fargate single-task; raise only with concurrent tasks |
| `connectionTimeoutMillis` | unset (default 0 = wait forever) | 5 000 | A stuck RDS endpoint must not hang boot/health |
| `statement_timeout` | unset | 30 000 | Bounds cost/latency of retrieval and heavy queries; especially relevant for HNSW on large tables |
| `idleTimeoutMillis` | unset (default 10s is the pg default, not explicit) | 30 000 | Return idle sockets to RDS |

The health endpoint's 2s probe plus these timeouts mean a DB outage surfaces as `error` on `/api/health` within seconds instead of hanging requests.

---

## 4. Migrations at boot — permissions

`runMigrations()` (`src/db/migrate.ts`) executes every `src/db/migrations/*.sql` that isn't in `_migrations`, each inside a transaction, **on every container start** (before `listen`). On RDS that means the **migration user needs DDL rights**:

- `CREATE TABLE` / `ALTER TABLE` (migrations 001–008) → needs `CREATE` on the database and ownership of created tables.
- `CREATE EXTENSION "pgcrypto"` / `"vector"` → needs **`rds_superuser`** on RDS.

Recommended split:

| User | Uses | Grants |
|---|---|---|
| `architect_migrator` (or the RDS master user) | Boot migrations (the `DATABASE_URL` during first boot) | `rds_superuser` (for `CREATE EXTENSION vector`), `CREATE` on DB |
| `architect_app` | Runtime (post-migration) | `SELECT/INSERT/UPDATE/DELETE` on app tables, `EXECUTE` on functions — **no DDL** |

Practical MVP path: point the app at the RDS **master user** first (master is `rds_superuser`), then swap to a least-privilege runtime user once migrations have run. Because migrations are idempotent-by-tracking-table (`_migrations`), switching users later is safe — already-applied files are skipped.

---

## 5. Dimension contract — `vector(1536)` ↔ embedding dimensions

`indexed_chunks.embedding` is `vector(1536)` with an HNSW index `using hnsw (embedding vector_cosine_ops)` (`004-indexed-chunks.sql`). The embedding provider must return **exactly 1536 dimensions** or every insert fails:

| Embedding provider | Config | Default dims | Fits `vector(1536)`? |
|---|---|---|---|
| OpenAI (`text-embedding-3-small`) | `EMBEDDING_DIMENSIONS` | 1536 | ✅ default matches |
| **Bedrock Titan v1 (`amazon.titan-embed-text-v1`, the default)** | `BEDROCK_EMBEDDING_DIMENSIONS` | 1536 | ✅ v1 outputs 1536 natively; `bedrock.ts` sends **no** `dimensions` field for v1 |
| Bedrock Titan v2 (`amazon.titan-embed-text-v2:0`, opt-in) | `BEDROCK_EMBEDDING_DIMENSIONS` | 1536 | ⚠️ **NO — Titan V2 accepts only 256/512/1024** |

Before Sprint 8, `BedrockClient.embed()` sent only `{ inputText }`, so Titan V2 returned its default **1024**-dimension vector into a `vector(1536)` column — every insert failed silently while still billing each Titan call. Sprint 8 fixed the contract:

- **Default path (recommended):** `BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1` (the config default). v1 outputs 1536 dimensions natively, matching the column with **no migration** and **no `dimensions` field** in the request.
- **V2 path (opt-in, smaller vectors → cheaper storage):** set `BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v2:0` and `BEDROCK_EMBEDDING_DIMENSIONS=1024` (or 512/256). The config schema **rejects** 1536 with a v2 model. This requires a column migration:
```sql
ALTER TABLE indexed_chunks ALTER COLUMN embedding TYPE vector(1024);
-- HNSW index must be dropped and recreated (dimension is part of the operator class)
DROP INDEX idx_indexed_chunks_embedding;
CREATE INDEX idx_indexed_chunks_embedding ON indexed_chunks USING hnsw (embedding vector_cosine_ops);
```

Whatever you choose, the contract is: **column dimension == `*_EMBEDDING_DIMENSIONS` == model output**, and the HNSW index must be created after the column dimension is final (index creation encodes the dimension). Verify before a production migration:

```sql
SELECT embedding::vector(1536) IS NOT NULL AS dim_ok, count(*) FROM indexed_chunks GROUP BY dim_ok;
```

---

## 6. Backups & retention

### 6.1 RDS automated backups + PITR

RDS gives you automated snapshots + point-in-time recovery at no extra code:

```bash
aws rds create-db-instance \
  --db-instance-identifier architectai \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 16.8 \
  --master-username architect \
  --manage-master-user-password \
  --allocated-storage 20 \
  --db-subnet-group-name architectai-subnets \
  --vpc-security-group-ids sg-rds \
  --backup-retention-period 7 \
  --preferred-backup-window 03:00-03:30 \
  --preferred-maintenance-window sun:04:00-sun:04:30 \
  --no-publicly-accessible

# Endpoint + generated master password (stored in Secrets Manager automatically)
aws rds describe-db-instances --db-instance-identifier architectai \
  --query "DBInstances[0].Endpoint"
aws secretsmanager get-secret-value --secret-id rds!db-architectai
```

`--backup-retention-period 7` = daily snapshots + PITR window; `--manage-master-user-password` stores the generated password in Secrets Manager (feed it into `DATABASE_URL` per `docs/aws/secrets.md`). Add `--multi-az` when you need HA; for an MVP single-AZ is fine.

**Restore drill (verify once):**

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier architectai \
  --target-db-instance-identifier architectai-restore \
  --restore-time 2026-08-10T03:00:00Z
```

### 6.2 Telemetry table growth

`generation_telemetry` grows **unbounded by design** (ADR-0012 accepts this for MVP; ~500 bytes/row). On RDS with a small instance this becomes a storage + `idx_telemetry_module_date` maintenance cost over months. **Recommend a retention cleanup** (not implemented — manual DBA task):

```sql
-- Example: keep 180 days of telemetry
DELETE FROM generation_telemetry WHERE timestamp < now() - interval '180 days';
-- then VACUUM to reclaim storage
VACUUM (ANALYZE) generation_telemetry;
```

Run it weekly via `pg_cron` (not enabled by default on RDS) or a scheduled Lambda/task; or partition by month and `DROP` old partitions. ADR-0012's review trigger (table > 1GB) is the moment this becomes mandatory.

---

## 7. Connection string examples

```bash
# Local compose (as today)
postgresql://architect:architect@db:5432/architectai

# RDS, production, TLS required
postgresql://architect:<password>@architectai.cluster-xxx.us-east-1.rds.amazonaws.com:5432/architectai?sslmode=require

# RDS with CA pinning (beyond MVP)
postgresql://architect:<password>@<endpoint>:5432/architectai?sslmode=verify-full&sslrootcert=/app/rds-ca-rsa2048-g1.pem
```

Keep the local string **without** `sslmode` (pg 8.13 attempts SSL only when requested; the compose Postgres doesn't need it) and the RDS string **with** it — the production gate checks for `sslmode`, so a production deploy without it is at least warned, and `docs/aws/secrets.md` keeps the RDS URL in Secrets Manager so the two never mix.

---

## 8. Pre-flight checklist

- [ ] `aws rds describe-db-engine-versions` confirms the minor + pgvector support
- [ ] RDS instance created in **private subnets** (`--no-publicly-accessible`), SG allows only the task SG on 5432 (`docs/aws/networking.md` §4)
- [ ] `DATABASE_URL` in production has `sslmode=require`; boot shows no SSL warning
- [ ] First boot uses a `rds_superuser` URL so `CREATE EXTENSION vector` succeeds; runtime user is least-privilege after
- [ ] Dimension contract verified: column == `BEDROCK_EMBEDDING_DIMENSIONS` (or `EMBEDDING_DIMENSIONS`) == model output — default Titan v1 (1536) matches; Titan v2 must be 256/512/1024
- [ ] Automated backups (≥7d) + one restore drill done; telemetry retention cleanup scheduled
