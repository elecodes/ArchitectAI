# ADR-0015: AWS Integrations Are Optional — Local-First Preserved

## Status

Accepted

## Date

2026-08-10

## Context

Sprint 6 (v1.2.0) shipped a 6-stage pipeline whose only cloud dependency was the LLM provider API key (ADR-0013). The roadmap (v2.0.0 — AWS Deployment) assumed AWS required a full production footprint: ECS, RDS, ALB, IAC.

Three pressures drove an incremental AWS step **before** full deployment:

1. **Bedrock reduces data-sensitivity friction.** OpenRouter/OpenAI route prompts to third parties; Bedrock keeps inference inside the same AWS account/org some teams already use.
2. **Persistence beyond the local disk.** Docker Compose stores artifacts on a host volume; teams wanted a durable, shareable artifact store without standing up a full stack.
3. **Observability without new dependencies.** Telemetry already exists (ADR-0012) but only lands in Postgres; CloudWatch metrics/logs are the natural home in an AWS account.

The standing constraints remain from earlier ADRs and the sprint-7 plan: **local-first, cloud-ready** (ADR-0013), **AI-focused telemetry** (ADR-0012), **provider-agnostic** LLM (ADR-0003/0013), and a past incident of **accidental AWS charges** makes cost safety a hard requirement.

Additionally, ADR-0014 (LLM Security Mitigations) has a live review trigger: "multi-user deployment". Sprint 7 is still single-user, but it introduces AWS as a data receiver, so the four deferred OWASP items must be re-evaluated against the new integrations.

## Decision

**All AWS integrations in ArchitectAI are optional, opt-in, and additive.** Enabling any of them must never change the default local experience, and each must be independently toggleable via environment variables.

1. **Bedrock** as an additional LLM/embedding provider (`LLM_PROVIDER=bedrock`, `EMBEDDING_PROVIDER=bedrock`) behind the existing `LLMClient` interface — one more case in the factory, no provider-specific logic elsewhere.
2. **S3** as an optional artifact store (`STORAGE_PROVIDER=s3`) behind a small `DocumentStore` interface (local store remains the default). The engineering-package export endpoint (`/api/export/:projectId`) becomes the single consumer.
3. **CloudWatch** as an optional telemetry sink (`CLOUDWATCH_ENABLED=true`) behind the existing telemetry record path — `PutMetricData` only, **off by default**, dynamically imported so local runs never initialize the SDK client.
4. **No provisioned infrastructure** is introduced: no RDS, ECS/Fargate, ECR, ALB, Route 53, auto-scaling, or Terraform/CDK. All integrations are pay-per-use API calls.
5. **Credentials** are resolved only via the AWS SDK default credential provider chain — never from application config — and IAM follows the least-privilege policy in `docs/aws/iam.md`. Cost safety measures (budgets, lifecycle, cleanup) are documented in `docs/aws/cost-safety.md` and were a required deliverable.
6. **Telemetry schema** gains an additive `provider` column (migration 008) so cost can be attributed per provider.

### Re-evaluation of ADR-0014 deferred items

| OWASP LLM Risk | ADR-0014 status | Re-evaluation with AWS |
|---|---|---|
| LLM03: Training Data Poisoning | Not applicable (no fine-tuning) | **Unchanged** — Bedrock models are AWS-managed; we don't train or fine-tune |
| LLM05: Supply Chain | Monitor via Dependabot | **Now active** — new AWS SDK dependencies (`@aws-sdk/*`) enter the supply chain; monitor them, and consider pinning minor versions |
| LLM07: Excessive Agency | No tool use | **Unchanged** — Bedrock `InvokeModel` is a pure inference call; the app still has no tool-use capability |
| LLM08: Excessive Functionality | Single-purpose generation | **Unchanged** — the AWS surface is exactly three service actions, documented in `docs/aws/iam.md` |
| LLM10: Model Theft | No custom models to steal | **Unchanged** — inference uses hosted foundation models; no weights are exposed |

New consideration: sending prompts to Bedrock moves the same data-sensitivity posture from "third-party API" to "AWS account". ADR-0014's mitigations (delimiter injection protection, output validation, `.architectai-ignore` sensitive-file blocking, rate limiting) remain fully in force and are provider-agnostic.

## Consequences

### Positive

- **Local-first preserved.** Default run has zero AWS presence; the feature set is identical without AWS.
- **Incremental adoption.** Teams can adopt one integration (e.g. Bedrock) without committing to full deployment.
- **Cost containment.** Pay-per-use only + budgets/lifecycle/cleanup docs address the past cost incident directly.
- **No lock-in.** Each integration is a small switch; turning it off is a config change, not a rollback.
- **Attributable telemetry.** The `provider` column maps cost to provider.

### Negative

- **Three more config surfaces** to document and validate (mitigated by zod schema + `.env.example`).
- **AWS SDK dependency weight** in `package.json` even for local-only users (mitigated by dynamic import — no runtime cost when disabled).
- **Credentials complexity** moves from "one API key" to the AWS provider chain (mitigated by least-privilege IAM docs and preferring IAM roles).
- **No full deployment value yet** — teams that need ECS/RDS still wait for v2.0.0.

## Review Trigger

Re-evaluate this decision when ANY of these conditions become true:

- The default, out-of-the-box experience requires AWS (e.g. `STORAGE_PROVIDER=s3` as default) — the "optional" property is violated
- A second consumer of the `DocumentStore` needs S3-specific semantics (encryption keys, versioning, TTL) that force provider branches into shared code
- Bedrock/CloudWatch usage requires provisioned resources (streaming with `InvokeModelWithResponseStream`, Guardrails) that break the pay-per-use model
- v2.0.0 deployment work begins — the "no provisioned infrastructure" boundary is intentionally lifted then
- An AWS SDK version (CVE, licensing) forces the supply-chain posture to change

## Alternatives Considered

**Full v2.0.0 AWS deployment now:** Rejected. Contradicts incremental delivery (Principle 5) and multiplies cost/security surface before any team needs it. The optional-integration path delivers Bedrock/S3/CloudWatch value without ECS/RDS/IAC.

**Provider-specific storage abstraction (S3-native API surface in routes):** Rejected. The `DocumentStore` interface keeps S3/local symmetric and testable (ADR-0003 spirit). A richer S3 API would leak provider semantics into the export route.

**CloudWatch Logs SDK integration in-app:** Rejected. pino JSON to stdout is already correct (ADR-0012); the Docker `awslogs` log driver ships it to CloudWatch Logs with zero code. SDK-based logging would duplicate the log pipeline for no benefit.

**Always-on CloudWatch sink:** Rejected. Violates "optional, opt-in" and would emit to a cloud resource from every local run; the sink is gated and dynamically imported.

**Access keys in config:** Rejected outright. Only the SDK default credential provider chain is supported, matching the least-privilege and no-committed-secrets rules in `docs/aws/iam.md`.
