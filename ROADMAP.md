# ArchitectAI — Product Roadmap

## Version 1.x

Improvements that extend the current MVP without changing the architecture.

---

### v1.1.0 — Repository Review Assistant ✅ delivered

Analyze an existing codebase and receive an automated architecture review.

- Analyze existing codebase structure
- Detect architectural patterns (layered, modular, monolithic)
- Identify SOLID violations and coupling issues
- Generate improvement recommendations
- Produce an Architecture Health Report artifact

---

### v1.2.0 — Architecture Visualization ✅ delivered

Six-stage generation pipeline with visual architecture output.

- 6-stage pipeline: Vision → Requirements → Architecture → Diagrams → Tasks → Risks
- Mermaid diagrams (Context, Container, Component, Data Flow) rendered from generated source
- Rich engineering package export (README, requirements, architecture, diagrams, risks, tasks, metadata)
- Risk assessment with severity tags, per-diagram SVG/PNG export

---

### v1.3.0 — AWS Foundation ✅ delivered

Optional, opt-in AWS integrations that preserve the local-first default.

- **Bedrock** LLM + embeddings provider (`LLM_PROVIDER=bedrock`, `EMBEDDING_PROVIDER=bedrock`)
- **S3** artifact storage (`STORAGE_PROVIDER=s3`) with server-side export endpoints
- **CloudWatch** telemetry sink (`CLOUDWATCH_ENABLED=true`, off by default)
- Generation telemetry wired to all six endpoints; least-privilege IAM + cost-safety docs

> Repository Chat (multi-turn Q&A over indexed files, previously listed as v1.2.0) was **deferred** to prioritize the pipeline/visualization work. It remains a candidate for a future 1.x release.

---

### v1.4.0 — Security & Production Hardening ✅ delivered

Production hardening for AWS operations: security fixes, real health checks, and release automation.

- Security hardening: production env gate, path containment, artifact IDOR fix, dedicated export/index rate limits, request correlation IDs
- Real `/api/health` probes (DB/LLM/storage/telemetry) and graceful shutdown
- Bedrock embedding default fixed to Titan v1 (1536 dims, matching `vector(1536)`)
- AWS ops docs (`docs/aws/*`) + security review (`docs/security/sprint8-review.md`)
- Docker HEALTHCHECK fix and Dependabot (root npm, frontend, github-actions)

---

### v1.5.0 — Architecture Improvements

Enhance the core generation quality and output richness.

- API design generation (OpenAPI spec from requirements)
- Database schema generation from architecture
- Improved prompt engineering based on feedback data
- Proper tokenizer (replace chars/4 heuristic)
- Streaming responses (SSE for real-time output)

---

### v1.6.0 — Prompt Version Analytics

Data-driven prompt improvement using telemetry and feedback.

- Dashboard showing generation success rates per prompt version
- Token usage trends over time
- Retry rate analysis (which prompts cause most failures)
- Correlation between prompt versions and user feedback (thumbs up/down)
- A/B testing framework for prompt changes
- Evaluation dataset for regression testing

---

## Version 2.x

Major capabilities that introduce new architecture or deployment options.

---

### v2.0.0 — AWS Deployment

Production cloud deployment on AWS infrastructure.

Partially delivered by v1.3.0: ✅ Bedrock as LLM provider, ✅ S3 artifact storage, ✅ CloudWatch monitoring (metrics), ✅ IAM least-privilege policies (docs), ✅ Cost monitoring/billing alerts (docs). Remaining work below.

- ECS / Fargate task definitions
- RDS PostgreSQL with pgvector extension
- CloudWatch logging and alarms (metrics ship today via PutMetricData; logs via the Docker `awslogs` driver)
- Secrets Manager for API keys and JWT secrets
- ECR container registry
- CI/CD pipeline (GitHub Actions → ECR → ECS)
- Application Load Balancer + SSL + custom domain
- Auto-scaling based on generation load
- Infrastructure-as-Code (CDK or Terraform)

---

### v2.1.0 — Enterprise Collaboration

Multi-user support with team features.

- User registration and multi-user authentication
- RBAC (Admin, Architect, Viewer roles)
- Refresh tokens and session management
- Shared projects with team access control
- Human review workflows (draft → review → approved)
- Audit trail per user action
- Project templates and sharing
- Organization management

---

### v2.2.0 — Marketplace of Reusable Architect Templates

Community-driven architecture templates.

- Template library (e-commerce, SaaS, API platform, microservices)
- Publish and share architecture templates
- Template versioning and ratings
- Customizable template parameters
- Import/export templates across organizations
- Template composition (combine multiple templates)

---

## Versioning Policy

From v1.0.0 forward:

- Every new feature goes into its own feature branch
- Every feature becomes its own sprint
- Every sprint increments the semantic version
- Patch versions (x.x.1) for bugfixes only
- Minor versions (x.1.0) for new features
- Major versions (2.0.0) for architectural changes
