# ADR-0024: Archify Diagram Automation, Creation Date Tracking & HTML Export

## Status

Accepted

## Context

Following the adoption of Archify interactive diagram rendering and architecture diffing (ADR-0023), engineering teams required:
1. Provenance tracking: knowing exactly when an interactive diagram map was created.
2. Direct HTML artifact export: allowing developers to download and share self-contained interactive `.html` maps directly from the UI or compiled output.
3. Diagram compilation automation: a CLI and package script workflow to programmatically compile and update system maps, runtime architectures, and multi-agent cognitive brain flows without manual steps.

## Decision

We have implemented:
1. **Creation Date Tracking (`createdAt`)**:
   - Added an optional `createdAt` ISO 8601 timestamp field to `ArchifyDiagramIR.meta`.
   - Injected the timestamp into the rendered HTML header subtitle (`<div class="created-at">Created: ...</div>`).
2. **Interactive HTML & JSON Export**:
   - Integrated a **"Download HTML"** control button in the compiled diagram header alongside theme toggles and JSON export.
   - Designed a 3-tier browser download engine (`triggerDownload`):
     - Native OS Save File Picker (`showSaveFilePicker`) for Chrome/Edge.
     - `application/octet-stream` Blob download to bypass browser `file://` mime security blocks.
     - Clipboard fallback with user alerts if browser sandbox policies restrict direct downloads.
3. **Diagram Automation Scripts**:
   - Added `scripts/generate-archify-diagrams.ts` and `scripts/generate-brain-flow.ts`.
   - Exposed `npm run generate:diagrams`, `npm run generate:brain-flow`, and `npm run archify:automate`.

## Consequences

### Positive
- Every compiled Archify diagram carries explicit ISO date provenance for architectural tracking over time.
- Users can export self-contained, interactive `.html` diagrams directly from their browser with zero external dependencies.
- Build and CI pipelines can execute `npm run generate:diagrams` to keep repository architecture maps up to date automatically.

### Negative
- Output `.html` files in `docs/architecture/` are updated upon re-running automation scripts.
