# Archify Agent Skill — ArchitectAI Usage Guide

This document defines how AI coding agents (Antigravity, Cursor, Claude Code, Codex CLI) should utilize [Archify](https://github.com/tt-a1i/archify) when interacting with the ArchitectAI codebase.

---

## Capabilities & Triggers

Use the **Archify Skill** whenever:
1. Explaining or visualizing system architecture, bounded contexts, or data flows.
2. Reviewing pull requests, refactors, or architectural drift using **Architecture Diff** (*Before vs After*).
3. Exporting interactive HTML system maps to accompany engineering documentation.

---

## Core Conventions for ArchitectAI

### Semantic Roles & Layer Mapping
When constructing an `ArchifyDiagramIR`, map components to Archify roles according to their architectural layer:

| Layer | Archify Role | Examples in ArchitectAI |
|-------|--------------|--------------------------|
| `interface` | `interface` | `ExpressAPI`, `AgentWorkflowRoutes`, `GeneratePage` |
| `application` | `application` | `Orchestrator`, `AgentRunner`, `ReviewPipeline` |
| `domain` | `domain` | `RequirementsAgent`, `ArchitectureAgent`, `SynthesisAgent` |
| `infrastructure` | `infrastructure` | `BedrockClient`, `GoogleClient`, `S3Store` |
| Infrastructure (Data) | `database` | `PostgresDatabase`, `PgVectorIndex`, `LocalDocumentStore` |

---

## Code Examples

### 1. Generating a System Map
```typescript
import { generateArchifyIR, compileArchifyHtml } from '../src/diagrams/archify.js';

const ir = generateArchifyIR(archDocument, 'ArchitectAI System Map');
const html = compileArchifyHtml(ir);
// Save html to docs/architecture/system-map.html
```

### 2. Computing an Architecture Diff (Before vs After)
```typescript
import { compareArchitectureDocuments } from '../src/review/diff-service.js';

const diffPackage = compareArchitectureDocuments(beforeDoc, afterDoc, 'Refactor Review');
console.log(diffPackage.summaryText);
// diffPackage.htmlReport contains the interactive Before / Delta / After HTML
```

---

## Installation Command
```bash
npx skills add tt-a1i/archify -g
```
