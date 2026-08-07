# ArchitectAI — Product Roadmap

## Version 1.x

Improvements that extend the current MVP without changing the architecture.

---

### v1.1.0 — Repository Review Assistant

Allow users to upload or connect a repository and receive an automated architecture review.

- Analyze existing codebase structure
- Detect architectural patterns (layered, modular, monolithic)
- Identify SOLID violations and coupling issues
- Generate improvement recommendations
- Produce an Architecture Health Report artifact

---

### v1.2.0 — Repository Chat

Enable conversational interaction with indexed project files.

- Ask questions about the codebase ("How does auth work?", "What does this module do?")
- RAG-powered answers grounded in actual project files
- Context-aware follow-up questions
- Citation of source files in responses
- Conversation history per project

---

### v1.3.0 — Architecture Improvements

Enhance the core generation quality and output richness.

- Mermaid diagram generation from architecture documents
- C4 model support (Context, Container, Component levels)
- API design generation (OpenAPI spec from requirements)
- Database schema generation from architecture
- Improved prompt engineering based on v1.0 feedback data
- Proper tokenizer (replace chars/4 heuristic)
- Streaming responses (SSE for real-time output)

---

### v1.4.0 — Prompt Version Analytics

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

- ECS / Fargate task definitions
- RDS PostgreSQL with pgvector extension
- Bedrock as additional LLM provider
- S3 for document and artifact storage
- CloudWatch monitoring, logging, and alarms
- Secrets Manager for API keys and JWT secrets
- ECR container registry
- CI/CD pipeline (GitHub Actions → ECR → ECS)
- Application Load Balancer + SSL + custom domain
- IAM roles and least-privilege policies
- Auto-scaling based on generation load
- Cost monitoring and billing alerts
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
