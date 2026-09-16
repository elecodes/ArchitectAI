# ADR-0023: Archify Interactive Diagrams and Architecture Diff

## Status

Accepted

## Date

2026-09-16

## Context

ArchitectAI previously produced static Mermaid.js diagram definitions (`.mmd`) rendered to static PNG/SVG images. While effective for basic visualization, static diagrams have key limitations:

- Lack of interactive exploration (no node filtering, search, theme toggling, or dependency highlighting).
- Difficulty visualizing architecture evolution and refactoring impact between Pull Requests or commits (*Before vs After*).
- Static images do not provide typed Intermediate Representation (IR) data for downstream agent consumption.

To solve this, we evaluated [Archify](https://github.com/tt-a1i/archify), a Node.js rendering system and Agent Skill designed for interactive, self-contained system maps and snapshot diffing.

## Decision

Integrate Archify as an interactive diagramming engine, architecture diff service, and Agent Skill:

1. **Dual Diagram Generator** — Retain static Mermaid.js diagrams for markdown compatibility, while adding Archify JSON IR (`generateArchifyIR`) and self-contained interactive HTML compilation (`compileArchifyHtml`) to all exported `.zip` packages (`04-diagrams/architecture-interactive.html` and `04-diagrams/archify-spec.json`).
2. **Architecture Diff Engine** — Implement `compareArchifyIR` and `compareArchitectureDocuments` in `src/review/` to compute deterministic architecture deltas (*Before vs Delta vs After*) with color-coded node/edge changes (green = added, red = removed, amber = modified).
3. **Agent Skill Integration** — Register `tt-a1i/archify` as a local Agent Skill (`~/.agents/skills/archify`) and document usage conventions in `docs/skills/archify-skill.md` so coding agents can generate interactive system maps during codebase refactoring and design tasks.

## Consequences

### Positive

- **Interactive System Maps**: Generated engineering packages include self-contained interactive HTML maps with zero external server runtime requirements.
- **Visual Refactoring Reviews**: Architectural changes between branches or commits can be audited visually with tabbed Before / Delta / After views.
- **Agent Interoperability**: AI coding agents can produce and consume typed Archify JSON IR specs.

### Negative

- Slight increase in package export size due to including self-contained HTML resources.
- Parallel maintenance of Mermaid `.mmd` generators alongside Archify IR transformers.
