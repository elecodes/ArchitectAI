# ArchitectAI — Engineering Constitution

These principles govern every engineering decision in ArchitectAI. They are non-negotiable. When in doubt, refer here. When principles conflict, the lower-numbered principle wins.

---

## Principle 1: Prefer simplicity over cleverness

A solution that a new engineer understands in 10 minutes beats an elegant solution that requires a whiteboard session. If you need to explain why a pattern exists — question whether it should exist at all.

**In practice:**

- No abstraction without two concrete implementations needing it
- No design pattern without a problem it solves TODAY
- If a function does the job, don't make it a class
- If a class does the job, don't make it a framework

**Violation example:** Creating a Port/Adapter layer for storage when PostgreSQL is the only database.

---

## Principle 2: Every AI output is untrusted until validated

The LLM is a probabilistic text generator, not a deterministic function. Its output will be malformed, incomplete, hallucinated, or structurally invalid at unpredictable rates. Treat every LLM response the same way you treat user input from the internet: validate, parse, schema-check, and handle failure.

**In practice:**

- Every LLM response passes through JSON parse + zod schema validation
- No LLM output is persisted or displayed without successful validation
- Retry logic exists for recoverable failures (invalid JSON)
- No retry for infrastructure failures (timeout, connection refused)
- Always log raw LLM output on validation failure for debugging

**Violation example:** Calling `JSON.parse(llmResponse)` without a try/catch and using the result directly.

---

## Principle 3: Prompt files are source code

Prompts define the product's behavior. A prompt change is a feature change. Prompts deserve the same rigor as application code: version control, review, testing, and provenance tracking.

**In practice:**

- Prompts live in versioned files (`spec-v1.md`, `architecture-v1.md`)
- Every generated artifact records which prompt version produced it
- Prompt changes require the same review process as code changes
- Prompts are loaded at startup and cached — never constructed inline
- Prompt regression is a production incident

**Violation example:** Hardcoding a system prompt as a template literal inside a generator function.

---

## Principle 4: Measure before optimizing

Do not optimize based on assumptions. Instrument first, collect data, then make decisions backed by evidence. A slow system with telemetry is more valuable than a fast system you can't debug.

**In practice:**

- Every LLM call records: duration, tokens (prompt + completion), model, prompt version
- Every RAG retrieval records: query time, chunks returned, similarity scores
- Every context window operation records: budget used, truncation events
- Decisions about model selection, chunk size, or similarity thresholds must reference telemetry data
- Performance improvements require before/after measurements

**Violation example:** Switching to a different chunking strategy because "it should be better" without measuring retrieval precision.

---

## Principle 5: Build only today's abstractions

An interface for one implementation is not an abstraction — it's indirection. A pattern without a current problem is not architecture — it's speculation. Build what you need now. Extract what you need when the second use case arrives.

**In practice:**

- The LLMClient interface exists because multiple providers need it NOW (OpenRouter, OpenAI, Ollama, Mock)
- Port/Adapter for storage does NOT exist because there's only PostgreSQL
- The Agent Orchestrator does NOT exist because there's only one pipeline
- Every "deferred" pattern has a documented trigger ("add when X happens")
- If you catch yourself saying "we might need this later" — stop

**Violation example:** Building a plugin discovery framework for AI agents when the system has exactly three sequential prompt calls.

---

## Principle 6: Human judgment always overrides AI

ArchitectAI is a co-pilot, not an oracle. The system generates drafts. Humans make decisions. No AI output should be auto-applied without human review. The user always has the final word.

**In practice:**

- Generated artifacts are presented as drafts, never as final
- The UI uses language like "suggested" and "draft" — never "correct" or "optimal"
- Quality scoring is informational, never blocking (user can always proceed)
- Structural validation is optional and user-triggered
- User feedback (thumbs-up/down) is the ground truth — not the self-review score

**Violation example:** Blocking artifact delivery because the self-review scored it below 70.

---

## Principle 7: Context windows are finite — respect the budget

Every token counts. A model with 8192 tokens cannot be asked for 10,000 tokens of input. Context window overflow produces silent garbage. Budget management is not an optimization — it's a correctness requirement.

**In practice:**

- Every LLM call passes through the Context Window Manager
- Budget: system prompt + user input + RAG context + reserved output ≤ context window
- When budget is exceeded, RAG chunks are progressively removed (lowest similarity first)
- Truncation is ALWAYS logged — never silent
- The system never assumes "the model will figure it out" with overflowing context

**Violation example:** Concatenating 5 RAG chunks into a prompt without checking if the total fits the model's context window.

---

## Principle 8: Fail explicitly, never silently

When something goes wrong, the system must tell the user clearly and immediately. Silent failures — where the system appears to work but produces garbage — are worse than errors. A visible error is a fixable error.

**In practice:**

- LLM timeout → return HTTP 504 with duration information
- Invalid LLM output after retry → return HTTP 500 with error details
- Context overflow → log warning AND return metadata showing truncation
- RAG indexing failure → report which files failed and why, continue with others
- Health check → report degraded state before full failure
- Never swallow exceptions in async operations

**Violation example:** Catching an embedding error and returning an empty RAG context without logging or telling the user.

---

## Principle 9: Observability is not optional

If you can't see what the system is doing, you can't fix it, improve it, or trust it. Every AI operation must leave a trace. Telemetry is the difference between "it works" and "we know WHY it works."

**In practice:**

- Structured JSON logs for every generation (tokens, duration, status)
- Provenance on every artifact (model, prompt version, timestamp, retry count)
- Telemetry persisted to database — not just stdout
- Error logs include enough context to reproduce the failure
- Generation metrics enable data-driven decisions about models and prompts

**Violation example:** A generation that takes 45 seconds with no log entry explaining what happened during those 45 seconds.

---

## Principle 10: Security is proportionate to threat model

Don't build enterprise security for a local single-user system. Don't skip security entirely for a system that processes proprietary code. Match your security investment to your actual threat surface.

**In practice:**

- MVP (local, single-user): JWT with 24h expiry, delimiter-based prompt isolation, startup secret validation
- No data leaves the machine unless the user explicitly configures a cloud LLM provider
- RAG isolation by project ID — no cross-project leakage
- API keys stored in environment variables, never committed to code
- Secrets never have default values in production configuration
- Scale security investment with deployment scope (local → team → enterprise)

**Violation example:** Building OAuth2 + PKCE + refresh token rotation for a single-user Docker application.

---

## Principle 11: Local-first. Cloud-ready.

The application and database always run locally. The LLM inference does NOT need to. "Local development" and "local inference" are different concerns. Do not impose hardware constraints on developers by coupling the application to local GPU availability.

**In practice:**

- Docker Compose runs the app and database — that's it by default
- LLM provider is a configuration choice, not an architectural constraint
- Cloud providers (OpenRouter, OpenAI) are first-class, not secondary adapters
- Ollama is supported but optional — useful for offline/privacy scenarios
- No provider-specific logic in generation, RAG, or pipeline code
- The system should be fully usable with Docker + Node.js + internet. No GPU.

**Violation example:** Requiring Ollama to be running for the application to start, when the user configured OpenRouter as their provider.

---

## Principle 11: The monolith is the correct architecture until proven otherwise

Microservices are a scaling solution, not an architecture best practice. For a single engineer building an MVP, one process with well-organized modules is faster to build, easier to debug, and simpler to deploy.

**In practice:**

- One Express.js process handles all business logic
- Modules communicate via function calls, not HTTP/gRPC
- Shared TypeScript types eliminate serialization bugs
- Docker Compose: app + database + LLM = three containers
- Extract a module into a service ONLY when you have measured evidence it needs independent scaling

**Violation example:** Deploying the RAG indexer as a separate microservice before proving it's a bottleneck.

---

## Principle 12: Tests prove properties, not coverage percentages

A test suite with 95% coverage that doesn't verify correctness is theater. Property-based tests that prove invariants across all valid inputs are worth more than a hundred hardcoded assertion tests.

**In practice:**

- Property-based tests for algorithmic correctness (context window math, DAG validation, chunking round-trips)
- Unit tests for specific failure modes (timeout, malformed JSON, expired tokens)
- Integration tests for end-to-end flows (with mocked LLM via the interface)
- No test exists without a clear statement of what it proves
- Flaky tests are deleted, not retried

**Violation example:** Writing 50 snapshot tests for LLM output format instead of one property test that validates the schema contract.

---

## How to Use This Document

1. **Before starting a feature:** Read the relevant principles. If your approach violates one, reconsider.
2. **During code review:** Reference specific principles when requesting changes.
3. **When debating a decision:** The lower-numbered principle wins in a conflict.
4. **When onboarding:** New engineers read this on day one before touching code.
5. **When evolving the system:** Principles may be updated, but only through team consensus and documented rationale.

---

_This constitution is a living document. It evolves with the project. But it evolves slowly and deliberately — like a real constitution should._
