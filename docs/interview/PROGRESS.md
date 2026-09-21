# Mock-Interview Voice Module — Progress Log

This document tracks phase-by-phase execution, architectural decisions, dependencies, and verification results for the Mock-Interview Voice Module and URL Evaluator Extraction.

---

## Phase 0: Reconnaissance & Decisions (2026-09-21)

### Status: Complete & Awaiting Approval for Phase 1

### 1. Done
- **Full Codebase Audit:**
  - Audited layout, routing, and sidebar components (`app/layout.tsx`, `app/page.tsx`).
  - Audited existing URL relevance evaluator UI entry points (`app/page.tsx:928-1153`), API route (`app/api/eval/url/route.ts`), underlying scraper (`lib/url-evaluator.ts`), and evaluation engine (`lib/ai-evaluator.ts`, `lib/scorer/v2.ts`).
  - Audited Drizzle database and migration architecture: SQLite (`better-sqlite3`, `lib/db/index.ts`, `lib/db/schema.ts`) is the active store with auto-migration (`initDb()`); Neon (`lib/db-neon.ts`) is frozen.
  - Audited local files (`data/` directory) and dual-persistence patterns.
  - Audited environment handling (`.env.local`), test runner (`vitest`), and linting configuration (`next lint`).
  - Audited WebSocket usage (no existing WebSocket implementation; verified Next.js 14 Route Handlers cannot sustain stateful duplex sockets).
- **Core Documentation Written:**
  - `docs/interview/00-recon.md`: Findings, file paths, and risk analysis.
  - `docs/interview/01-prd.md`: Goals, non-goals, user stories, session types, and success metrics.
  - `docs/interview/02-hld.md`: Components, Mermaid architecture & sequence diagrams, failure modes.
- **Architectural Decision Records (ADRs) Formulated & Recorded:**
  - `docs/interview/adr/ADR-001-live-transport.md`: Local server-side WebSocket proxy (`pnpm interview:server` on `127.0.0.1:4001`) vs browser-direct tokens.
  - `docs/interview/adr/ADR-002-storage.md`: SQLite / Neon Drizzle schema for session tracking paired with local markdown dossiers (`data/interviews/*.md`).
  - `docs/interview/adr/ADR-003-model-registry.md`: Centralized model registry and verification of Gemini Live API capabilities (duplex transcription, sliding window compression, session resumption).
  - `docs/interview/adr/ADR-004-cost-control.md`: Token metering, FX configuration, warning thresholds (50%/80%), and hard monthly budget cap (INR 15,000).

### 2. Not Done (Scheduled for Subsequent Phases)
- Phase 1: Isolated `/evaluate` page and "Evaluate Any Job Opening URL" sidebar item.
- Phase 2: Content Interview Pack (rubrics, hint ladders, question banks, system prompts, calibration samples).
- Phase 3: SQLite schema expansion & WebSocket proxy server implementation (`pnpm interview:server`).
- Phase 4: Interview Room UI (Robot avatar, AudioWorklet, Monaco, Excalidraw).
- Phase 5: Observer service & spoken interjections policy engine.
- Phase 6: Grader service, calibration validation, and progress tracking.
- Phase 7: Hardening, security, and documentation.

### 3. Dependencies Planned (With Justifications)
*To be added only when entering relevant phases:*
- `ws` & `@types/ws`: Standard Node.js WebSocket library for the local server proxy process (Phase 3).
- `@google/genai`: Official Google GenAI SDK supporting Gemini Multimodal Live API bidirectional audio sessions (Phase 3).
- `@monaco-editor/react`: Sandboxed in-browser C++ code editor with configurable autocomplete/snippet restrictions (Phase 4).
- `@excalidraw/excalidraw`: Freehand diagramming canvas for system design architecture sketching (Phase 4).

### 4. Quality Gate Verification (Phase 0)
- **TypeScript & Build:** Typecheck validated (`npx tsc --noEmit` / Next.js app structure intact).
- **ESLint:** Passed with 0 errors and 0 warnings (`pnpm lint`).
- **Unit Tests:** 22 test files / 98 tests passed in 25.13s (`pnpm test`).

### 5. Decisions Needed / Blocking Questions
- None blocking Phase 1. All architectural decisions (ADR-001 to ADR-004) are finalized and documented.
