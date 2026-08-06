# Tasks

## Sprint 1 — Project Foundation

- [x] 1. Repository scaffolding
- [x] 2. Docker Compose setup
- [x] 3. Environment configuration module
- [x] 4. Structured logging
- [x] 5. PostgreSQL connection pool
- [x] 6. Database migration system
- [x] 7. Full MVP database schema
- [x] 8. Express application setup
- [x] 9. Health check endpoint
- [x] 10. JWT authentication
- [x] 11. LLMClient interface and mock provider
- [x] 12. Prompt loader and versioning

## Sprint 2 — Generate (Provider → SpecGen → Context Manager → RAG)

- [ ] 13. OpenRouter provider implementation @depends(11)
  - [ ] 13.1 Create src/llm/providers/openrouter.ts implementing LLMClient with chat completions and embeddings
  - [ ] 13.2 Handle authentication, model selection, timeout (60s), and token extraction from response
  - [ ] 13.3 Handle rate limiting (429) and error responses with clear messages
- [ ] 14. OpenAI provider implementation @depends(11)
  - [ ] 14.1 Create src/llm/providers/openai.ts implementing LLMClient for chat completions
  - [ ] 14.2 Implement embedding via /v1/embeddings with configurable model and dimensions
  - [ ] 14.3 Handle rate limits, quota errors, and API errors gracefully
- [ ] 15. Update LLM factory with real providers @depends(13, 14)
  - [ ] 15.1 Wire OpenRouter and OpenAI providers into factory switch statement
  - [ ] 15.2 Validate that API key is present when cloud provider is selected
- [ ] 16. Output validator with zod schemas @depends(11)
  - [ ] 16.1 Create src/generation/output-validator.ts with JSON parse + zod validation
  - [ ] 16.2 Handle markdown code block extraction before JSON parse
  - [ ] 16.3 Return structured ValidationResult with raw output on failure
- [ ] 17. Retry logic @depends(16, 12)
  - [ ] 17.1 Create src/generation/retry.ts with generateWithValidation helper
  - [ ] 17.2 Retry once on JSON parse or schema failure with stricter prompt
  - [ ] 17.3 Never retry timeout or connection errors, max 1 retry
- [ ] 18. Zod schemas for generated artifacts @depends(16)
  - [ ] 18.1 Create SpecificationSchema (functionalRequirements, acceptanceCriteria, constraints, dependencies)
  - [ ] 18.2 Create ArchitectureDocumentSchema (components, dependencyGraph, boundedContexts, solidNotes)
  - [ ] 18.3 Create TaskBreakdownSchema (tasks with acceptanceCriteria, complexity, dependsOn)
- [ ] 19. Specification generator @depends(15, 17, 18, 12)
  - [ ] 19.1 Create src/generation/spec-generator.ts calling LLM with spec-v1 prompt
  - [ ] 19.2 Assemble user prompt with delimited sections (injection protection)
  - [ ] 19.3 Validate output against SpecificationSchema with retry
  - [ ] 19.4 Return typed Specification with generation provenance
- [ ] 20. Context Window Manager @depends(11)
  - [ ] 20.1 Create src/generation/context-window.ts with fitToContext method
  - [ ] 20.2 Calculate budget: contextWindow - system - input - reservedOutput = available for RAG
  - [ ] 20.3 Progressively include chunks (highest similarity first) until budget exhausted
  - [ ] 20.4 Log truncation events when chunks are dropped
- [ ] 21. File parser @depends(1)
  - [ ] 21.1 Create src/rag/file-parser.ts reading files from directory with extension filter
  - [ ] 21.2 Support .ts, .js, .md, .json, .yaml, .yml, .txt, .py, .java, .go
  - [ ] 21.3 Respect .architectai-ignore file, skip node_modules/.git/binary/files >1MB
- [ ] 22. Fixed-size chunker @depends(1)
  - [ ] 22.1 Create src/rag/chunker.ts splitting at paragraph boundaries
  - [ ] 22.2 Each chunk <= configured token count (default 512, estimated via chars/4)
  - [ ] 22.3 Guarantee round-trip property: concat(chunks) === original
- [ ] 23. RAG indexer @depends(21, 22, 14)
  - [ ] 23.1 Create src/rag/indexer.ts orchestrating parse → chunk → embed → store
  - [ ] 23.2 Delete existing chunks for project before re-indexing
  - [ ] 23.3 Skip failed files gracefully, return indexing summary
- [ ] 24. RAG retriever @depends(23, 20)
  - [ ] 24.1 Create src/rag/retriever.ts querying pgvector with cosine similarity
  - [ ] 24.2 Filter by project_id and minimum similarity threshold
  - [ ] 24.3 Return chunks sorted by similarity, limited to top-k
- [ ] 25. Integrate RAG into spec generator @depends(19, 24, 20)
  - [ ] 25.1 Update spec generator to retrieve RAG context before generation
  - [ ] 25.2 Pass RAG chunks through Context Window Manager before prompt assembly
  - [ ] 25.3 Include fitted chunks in delimited CONTEXT section

## Sprint 2.5 — Testing, Security, and CI

### Testing

- [ ] 26. Unit tests for Context Window Manager @depends(20)
  - [ ] 26.1 Property test: total tokens (system + input + RAG + reserved) never exceeds context window
  - [ ] 26.2 Property test: chunks are included in similarity-descending order
  - [ ] 26.3 Edge case: input alone exceeds budget → returns empty chunks, truncated=true
  - [ ] 26.4 Edge case: zero RAG chunks → returns empty, truncated=false
  - [ ] 26.5 Edge case: all chunks fit → returns all, truncated=false
- [ ] 27. Unit tests for Output Validator and Retry @depends(16, 17)
  - [ ] 27.1 Test: valid JSON matching schema → success
  - [ ] 27.2 Test: markdown-wrapped JSON → extracted and validated correctly
  - [ ] 27.3 Test: invalid JSON → triggers retry with stricter prompt
  - [ ] 27.4 Test: valid JSON but missing zod fields → triggers retry
  - [ ] 27.5 Test: both attempts fail → throws GenerationError with diagnostics
  - [ ] 27.6 Test: timeout error from LLM → NOT retried, thrown immediately
- [ ] 28. Unit tests for Chunker @depends(22)
  - [ ] 28.1 Property test: concatenation of all chunks equals original text (round-trip)
  - [ ] 28.2 Property test: every chunk tokenCount <= configured max
  - [ ] 28.3 Edge case: empty string → returns empty array
  - [ ] 28.4 Edge case: single paragraph exceeding max → returned as single chunk
- [ ] 29. Unit tests for Spec Generator @depends(19)
  - [ ] 29.1 Test with mock LLM returning valid spec JSON → returns typed Specification
  - [ ] 29.2 Test with mock LLM returning invalid JSON → retries once, succeeds on second attempt
  - [ ] 29.3 Test prompt assembly includes CONTEXT delimiters when RAG chunks provided
  - [ ] 29.4 Test prompt assembly has no CONTEXT section when zero RAG chunks
  - [ ] 29.5 Test provenance includes correct model, prompt version, retry count
- [ ] 30. Integration test for generation pipeline @depends(19, 20)
  - [ ] 30.1 Create test with mock LLM: input → context window fit → generate → validate → return
  - [ ] 30.2 Verify telemetry-ready metadata returned (tokens, duration, chunks used)
  - [ ] 30.3 Verify RAG chunks are truncated when budget exceeded (large input + many chunks)

### LLM Security (OWASP Top 10 for LLM Applications)

- [ ] 31. Prompt injection hardening @depends(19)
  - [ ] 31.1 Add instruction boundary markers in all system prompts (clear separation of instructions vs data)
  - [ ] 31.2 Add output schema enforcement: reject LLM output that contains instruction-like patterns outside expected JSON
  - [ ] 31.3 Add input sanitization for known injection markers (ignore previous, system:, assistant:) — log and strip, don't block
  - [ ] 31.4 Test: RAG chunk containing "ignore all previous instructions" does NOT alter generation output format
- [ ] 32. RAG namespace isolation @depends(24)
  - [ ] 32.1 Add integration test proving cross-project isolation (index project A, query as project B → zero results)
  - [ ] 32.2 Verify WHERE project_id clause is parameterized (no SQL injection via project_id)
  - [ ] 32.3 Add index on project_id + file_path for efficient deletion during re-index
- [ ] 33. Request rate limiting @depends(8)
  - [ ] 33.1 Add express-rate-limit middleware (100 req/min for general, 10 req/min for generation endpoints)
  - [ ] 33.2 Return 429 with Retry-After header when limit exceeded
  - [ ] 33.3 Rate limits configurable via environment variables
- [ ] 34. .architectai-ignore enforcement @depends(21)
  - [ ] 34.1 Unit test: files matching .architectai-ignore patterns are never indexed
  - [ ] 34.2 Add default patterns to skip: .env, .env._, _.key, _.pem, id_rsa, secrets._
  - [ ] 34.3 Log every ignored file with reason for audit trail
- [ ] 35. Input size limits and validation @depends(19)
  - [ ] 35.1 Enforce description length 10-50000 characters at API layer (zod)
  - [ ] 35.2 Reject empty or whitespace-only descriptions
  - [ ] 35.3 Limit maximum RAG project size (500 files, logged warning at 400)
  - [ ] 35.4 Test: oversized input returns 400 with clear error message

### Documentation

- [ ] 36. Security ADR and threat model @depends(31, 32, 33, 34)
  - [ ] 36.1 Create ADR-0014: LLM Security Mitigations (OWASP Top 10 alignment)
  - [ ] 36.2 Create docs/security/threat-model.md with attack surface, mitigations, and residual risks
  - [ ] 36.3 Document which OWASP LLM Top 10 items are addressed and which are deferred

### CI Pipeline

- [ ] 37. GitHub Actions CI workflow @depends(26, 27, 28)
  - [ ] 37.1 Create .github/workflows/ci.yml running on push and PR to main
  - [ ] 37.2 Jobs: lint (eslint), typecheck (tsc --noEmit), test (vitest run)
  - [ ] 37.3 Use Node.js 20, cache node_modules via actions/cache
  - [ ] 37.4 Fail pipeline if any job fails
