# ArchitectAI on AWS — Minimal Networking for a Single-Container Fargate Service

This document is a prescriptive-but-honest networking blueprint for running the single-container ArchitectAI API (the whole app — backend + frontend static files — in one image, see `Dockerfile`) on **ECS/Fargate** with `awsvpc` mode. It makes the cost decisions explicit up front so you don't pay for a NAT Gateway by default.

---

## 1. Decision summary

| Decision | Default | Rationale |
|---|---|---|
| VPC topology | 2 AZs, public + private subnets | Fargate needs ≥2 AZs for an ALB; private subnets keep the task off the internet |
| NAT Gateway | **NOT by default** | ~$32.85/mo + data-processing fees. Avoid until you need arbitrary outbound internet |
| Outbound to Bedrock/S3/CloudWatch | **VPC endpoints** (interface + gateway) | Free or ~$7/mo per interface endpoint per AZ — far below a NAT |
| MVP shortcut | Task in a **public subnet with no inbound rules** | Zero extra cost; outbound still needs egress rules or endpoints |
| Ingress | ALB → task :3001 only (or no ALB, health-check-only) | No public exposure of the container itself |

---

## 2. The NAT Gateway question (read before choosing)

Outbound traffic from Fargate tasks in private subnets needs *a* path to the services the app talks to:

| Destination | What the app calls | Options | Cost |
|---|---|---|---|
| Amazon Bedrock | `bedrock-runtime` API (`InvokeModel`) | Interface VPC endpoint (`com.amazonaws.<region>.bedrock-runtime`) | ~$0.01/hr per AZ (~$7.3/mo per AZ) |
| Amazon S3 | object storage | **Gateway endpoint (free)** or interface endpoint | Gateway = free; interface ≈ $7.3/mo/AZ |
| CloudWatch Logs / Metrics | `awslogs` driver + `PutMetricData` | Interface endpoint (`logs`, `monitoring`) | ~$7.3/mo/AZ each |
| PostgreSQL (RDS) | pg pool | **RDS is always private** — no internet, never via NAT | $0 |

- **NAT Gateway:** ~$0.045/hr = **~$32.85/mo**, plus $0.045/GB data processing. You pay for it 24/7 even when idle.
- **VPC endpoints:** a Bedrock interface endpoint + the S3 gateway endpoint cover the MVP (~$7–15/mo). Interface endpoints also keep traffic **off the public internet**, which is a security win for prompts sent to Bedrock.
- **Public-subnet MVP (cheapest):** run the task in a public subnet with a security group that allows **no inbound** (except the ALB / health check) and only outbound to the needed destinations. This is legitimate for an MVP, but the task has a public IP and its egress relies on SG rules instead of network isolation — tighten it when you add endpoints.

**Recommendation for this app:** two interface endpoints (`bedrock-runtime`, `monitoring` + `logs`) + the free S3 gateway endpoint, private subnets, no NAT. If you don't want endpoints yet, the public-subnet-no-ingress option is fine for a single-user MVP — the rate limiter and JWT auth are the actual perimeter, not the subnet.

---

## 3. VPC layout

| AZ | Public subnet | Private subnet | Contents |
|---|---|---|---|
| `us-east-1a` | `10.0.1.0/24` | `10.0.11.0/24` | Public: ALB (or nothing in MVP). Private: Fargate task |
| `us-east-1b` | `10.0.2.0/24` | `10.0.12.0/24` | Same |

The task runs in the **private** subnets (or public if you take the MVP shortcut). It needs no inbound internet; the ALB is the only ingress.

---

## 4. Security group rules

**Task security group (`sg-task`)** — only the app's port, from the ALB:

| Direction | Protocol/Port | Source/Dest | Purpose |
|---|---|---|---|
| Ingress | TCP 3001 | `sg-alb` | Only the ALB reaches the app |
| Ingress | TCP 3001 | `10.0.0.0/16` (VPC CIDR) | Operational/health access from within the VPC (optional) |
| Egress | HTTPS 443 | `com.amazonaws.us-east-1.bedrock-runtime` | Bedrock (via interface endpoint) |
| Egress | HTTPS 443 | `pl-xxxx` (S3 prefix list) | S3 via gateway endpoint |
| Egress | HTTPS 443 | `com.amazonaws.us-east-1.logs`, `com.amazonaws.us-east-1.monitoring` | CloudWatch logs/metrics (via interface endpoints) |
| Egress | TCP 5432 | `sg-rds` | RDS — the DB is never reachable from the internet |

**ALB security group (`sg-alb`)**:

| Direction | Protocol/Port | Source | Purpose |
|---|---|---|---|
| Ingress | HTTPS 443 (or HTTP 80 for MVP) | `0.0.0.0/0` | Client traffic to the ALB |
| Egress | TCP 3001 | `sg-task` | Forward to the task |

If you use the public-subnet MVP without an ALB, drop the `sg-alb` rules and rely on the `10.0.0.0/16` ingress for the health check — no inbound from the internet at all.

---

## 5. Health check (ALB target + ECS container health)

The image ships a working container healthcheck (`Dockerfile`, Sprint 8 fix):

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

- **ECS container health** uses this `HEALTHCHECK` — the container reports `healthy`/`unhealthy` in the service events.
- **ALB target group** should use the HTTP health check on **path `/api/health`**, port 3001, healthy threshold 2 / interval 30s. The endpoint returns **200** when aggregate status is `ok`, **503** otherwise (`src/api/routes/health.ts`) — exactly what an ALB treats as healthy/unhealthy.
- `/api/health` is a **public** route (mounted before auth in `src/api/index.ts`), so the health check needs no JWT.
- The 40s start-period matters: boot runs migrations before `listen`, so the container is genuinely not ready until ~seconds after start.

---

## 6. `TRUST_PROXY` behind the ALB

`TRUST_PROXY` (config default `false`) must be **`true`** when the app sits behind the ALB:

- It sets Express `trust proxy` (`src/api/index.ts`), so the rate limiter resolves the **real client IP** from `X-Forwarded-For` instead of the ALB's IP.
- **What it affects:** the per-client rate limits (general 100/min, generation 10/min, export 10/min, index 5/min — `src/api/middleware/rate-limiter.ts`). With `TRUST_PROXY=false` behind an ALB, **every user shares the ALB's IP and the limiters effectively become global** — one user exhausting the 10/min generation limit would throttle everyone.
- **Why not default it to true:** in a direct-exposure or local setup, trusting proxy headers lets a client spoof its IP and bypass per-client limits. Only enable behind a proxy you control.

---

## 7. Example Fargate service (sketch, no IaC yet)

```json
{
  "cluster": "architectai",
  "serviceName": "api",
  "taskDefinition": "architectai:5",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-private-1a", "subnet-private-1b"],
      "securityGroups": ["sg-task"],
      "assignPublicIp": "DISABLED"
    }
  },
  "loadBalancers": [{
    "targetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/architectai/abc123",
    "containerName": "api",
    "containerPort": 3001
  }],
  "healthCheckGracePeriodSeconds": 60
}
```

`awslogs` log driver config (task definition) and the secrets wiring are in `docs/aws/observability.md` §5 and `docs/aws/secrets.md` §3.1 respectively.

---

## 8. Tradeoffs at a glance

| Option | Monthly cost | Isolation | When to pick |
|---|---|---|---|
| Private subnets + NAT | ~$32.85 + data | Strong (no public IP) | Only if the app needs arbitrary outbound internet (it doesn't today) |
| Private subnets + VPC endpoints | ~$7–15 (2 interface + 1 gateway) | Strong, traffic stays in AWS | **Recommended** — Bedrock + CloudWatch + S3 only |
| Public subnet, no ingress, no NAT | **$0** | Weak-but-sufficient (SG only) | Single-user MVP / evaluation |

The application's AWS surface is exactly three services (Bedrock, S3, CloudWatch); there is **no** arbitrary-egress dependency, which is what makes the no-NAT default viable.
