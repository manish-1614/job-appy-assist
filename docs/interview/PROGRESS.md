# Mock-Interview Voice Module — Progress Log

This document tracks phase-by-phase execution, architectural decisions, dependencies, and verification results for the Mock-Interview Voice Module and URL Evaluator Extraction.

---

## Phase 0: Reconnaissance & Decisions (2026-09-21)

### Status: Complete

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

---

## Phase 1: "Evaluate Any Job Opening URL" Sidebar Menu & Route (2026-09-21)

### Status: Complete & Verified

### 1. Done
- **Data-Driven Navigation Architecture:**
  - Created `components/navigation/sidebar-config.ts` defining data-driven navigation items supporting route transitions (`href`) and dashboard view switching (`tab`).
  - Created `components/navigation/Sidebar.tsx` as a reusable component rendering the frosted glass sidebar, badge counters, cron schedule status, and manual scan triggers across all routes.
  - Added dedicated sidebar item labelled exactly: **"Evaluate Any Job Opening URL"** (short label: "Evaluate URL", icon: `Compass`, route: `/evaluate`).
  - Added active-route highlighting when visiting `/evaluate` with full tooltip/collapsed support.
- **Dedicated Route (`/evaluate`):**
  - Created `app/evaluate/page.tsx` containing the full evaluation flow:
    - URL input with format validation (ensures valid HTTP/HTTPS protocol).
    - Loading states with animated calculation indicators.
    - Result panel with 0–100% Fit Score gauge, matched strengths, sponsorship classification, tech stack badges, and key considerations.
    - Clear empty states explaining specialized ATS vs Cheerio extraction mechanisms.
    - Clear error banners for network or scraping anomalies.
    - Action bar: "Open Job Opening Directly" (external link), "Save to Active Openings" (persisting to SQLite), and "Tailor Application Kit ↗" (modal KitStudio).
- **Cleaned Dashboard & Removed Duplication:**
  - Removed old inline form and states from `app/page.tsx`.
  - Replaced inline evaluator with a quick-link callout to `/evaluate` (no dead links, zero duplicate code).
  - Wired `/?tab=<tab>` query parameter support on mount.
- **Unit Testing:**
  - Created `tests/phase1/evaluate-url.test.ts` (5 tests) verifying sidebar config integrity, route presence, URL protocol validation, and API 400 error responses.

### 2. Manual Verification Results
- **Real URL 1 (ATS - Greenhouse):**
  - Tested `https://boards.greenhouse.io/stripe/jobs/5202970`
  - Extracted Company: Stripe, Location: Remote in United States, Tech Stack: AWS Cloud, Fit Score: 68%. Success: `true`.
- **Real URL 2 (Company Board - Ashby/Linear):**
  - Tested `https://jobs.ashbyhq.com/linear`
  - Extracted Company: Linear, Tech Stack: Backend, Distributed Systems, Cloud, Fit Score: 65%. Success: `true`.
- **Quality Gates:**
  - `pnpm lint`: 0 errors, 0 warnings.
  - `pnpm test`: 23 test suites / 103 tests passed.
  - `pnpm build`: Both `/` (17.6 kB) and `/evaluate` (4.45 kB) compiled and statically generated with 0 errors.

### 3. Dependencies Added
- None. (Used existing `lucide-react`, `next/link`, `clsx`, `tailwind-merge`).

### 4. Decisions Needed / Blocking Questions
- None. Phase 1 is complete.

---

## Phase 2: Interview Pack & Calibration Content (2026-09-21)

### Status: Complete & Gate A Ready

### 1. Done
- **Machine-Readable Rubrics (`docs/interview/pack/rubrics/*.yaml`):**
  - `system-design.yaml`: 9 weighted dimensions anchored 1–4, emphasizing traffic-spike handling, decoupled async architecture, consistency/availability trade-offs, and failure recovery.
  - `advanced-dsa-cpp.yaml`: 7 dimensions covering modern C++ idioms, constraint bounds, Big-O analysis, edge-case dry runs, and hint penalty.
  - `behavioral-google.yaml`: 5 Googleyness & Leadership dimensions evaluating ambiguity navigation, conflict resolution, STAR impact, and humble self-reflection.
  - `communication-toptal.yaml`: 5 dimensions evaluating top-down structural clarity, conciseness, fluency, and handling pushback.
  - `solutions-fde.yaml`: 4 enterprise consultative dimensions covering customer discovery, technical translation, and rollout de-risking.
- **Hierarchical Hint & Probe Banks (`docs/interview/pack/hints/*.yaml`):**
  - `dsa-hint-ladder.yaml`: Strict 5-rung ladder (H0 restate -> H1 constraint nudge -> H2 technique class -> H3 approach outline -> H4 concrete step).
  - `system-design-probes.yaml`: Multi-tiered probe bank keyed by topic (spike, decoupling, failure, consistency, cost, observability) with 3 escalating probes each.
- **Curated Question Banks with Hidden Reference Approaches (`docs/interview/pack/questions/*.yaml`):**
  - `system-design.yaml`: 6 production distributed scenarios (flash-sale checkout, webhook delivery platform, rate limiter, feed fan-out, ride dispatch, log ingestion) with hidden reference solutions, spike handling, and failure modes.
  - `dsa-cpp.yaml`: 10 hard-tier C++ problems with optimal approaches, asymptotic bounds, edge cases, and C++ idioms.
  - `behavioral-and-screens.yaml`: 8 Google behavioral prompts, 6 Toptal communication prompts, and 3 Solutions/FDE scenarios.
- **Loop Templates (`docs/interview/pack/loops/*.md`):**
  - `toptal.md` and `google.md` with explicit `[ASSUMPTION — VERIFY AGAINST CURRENT PUBLIC SOURCES]` flags and verification checklists.
- **Parametrized Prompts & JSON Schemas (`docs/interview/pack/prompts/` & `schemas/`):**
  - `interviewer.system.md`: Refined Live system prompt enforcing brevity (1–3 sentences), zero unearned praise, and `[INTERNAL-OBSERVER]` handling.
  - `observer.system.md` & `schemas/observer-output.schema.json`: Structured drift detection prompt and schema.
  - `grader.system.md` & `schemas/grader-output.schema.json`: Adversarial post-interview grading prompt and schema enforcing the Zero-Fabrication rule.
- **Templates & Execution Plans:**
  - `templates/session-log.md`: Standardized manual session log.
  - `manual-session-plan.md`: Step-by-step guide for running 5 calibration sessions in Google AI Studio Live, model comparison matrix (`gemini-3.8-live` vs `gemini-3.8-live-extended-thinking`), and instructions for scheduling 2 paid human mocks.
- **Calibration Datasets (`docs/interview/pack/calibration/*.yaml`):**
  - 3 deliberately weak and 3 strong sample responses each for System Design, Advanced DSA (C++), and Google Behavioral rounds to calibrate the automated grader in Phase 6.

### 2. Verification & Deliverables
- Verified all rubrics, hint ladders, question banks, and calibration samples.
- All YAML files verified syntactically valid and parseable via `yaml`.

---

## Phase 3: Data Model & Live Proxy (2026-09-21)

### Status: Complete & Verified

### 1. Done
- **SQLite Schema & DDL Updates (`lib/db/schema.ts`, `lib/db/index.ts`):**
  - Created 6 interview tables: `interview_sessions`, `interview_turns`, `interview_events`, `interview_snapshots`, `interview_scores`, `interview_usage`.
  - Added WAL mode and auto-migration in `initDb()`.
- **Wire Protocol (`lib/interview/protocol.ts`, `docs/interview/03-protocol.md`):**
  - Specified all client-to-server and server-to-client JSON messages.
  - Base64 linear PCM framing: 16kHz audio input, 24kHz audio output.
- **Cost Metering & Budget Guard (`lib/interview/cost-meter.ts`):**
  - Real-time token calculation for Live audio/text, observer, and grader models.
  - Implemented hard monthly budget cap (INR 15,000) and progressive warning levels (`none`, `info`, `warning`, `critical`, `blocked`).
- **Session Coordinator & WebSocket Proxy Server (`scripts/interview-server.ts`, `lib/interview/session-manager.ts`):**
  - Standalone server on `127.0.0.1:4001` coordinating browser WebSockets with Google Gemini Live API.
  - Dynamic prompt compilation with questions and candidate profile (`lib/interview/prompts.ts`).
- **Smoke Test Script (`scripts/interview-smoke.ts`):**
  - Complete CLI verification script (`pnpm interview:smoke`) testing connection, synthetic audio chunk, digest ingestion, usage update, and DB persistence.

---

## Phase 4: Interview Room UI & Visual Context Synchronization (2026-09-21)

### Status: Complete & Verified

### 1. Done
- **Sidebar Integration (`components/navigation/sidebar-config.ts`):**
  - Added dedicated navigation item `"Mock Interview (Voice)"` (`/interview`) with `Bot` icon.
- **Setup Screen (`app/interview/page.tsx`):**
  - Persona selector (Google vs Toptal), round selector, dynamic question dropdown, and preview card.
  - Monthly budget gauge with live INR spend vs INR 15,000 ceiling.
  - Real-time microphone test meter with RMS volume indicator.
- **Interview Room (`app/interview/[id]/page.tsx`):**
  - Split-screen layout: 40% Left Panel (avatar + captions + controls), 60% Right Panel (canvas / editor / notes).
  - SVG Robot Avatar (`components/interview/RobotAvatar.tsx`) driven by Web Audio RMS with responsive states (`listening`, `thinking`, `speaking`, `interrupted`).
  - Integrated Excalidraw (`components/interview/ExcalidrawCanvas.tsx`) for System Design with real-time semantic topology digest generator (`lib/interview/digest.ts`).
  - Integrated Monaco C++ editor (`components/interview/MonacoCppEditor.tsx`) with interview-grade distraction constraints (autocomplete and snippets disabled).
  - Audio pipeline: `AudioRecorder` (16kHz PCM capture) and `AudioPlayer` (24kHz playback with instant barge-in buffer flush).
- **Session History Screen (`app/interview/history/page.tsx`):**
  - Displays all past sessions with date, company, round, duration, turn count, and cost.

---

## Phase 5: Observer Service & Spoken Interjections (2026-09-21)

### Status: Complete & Verified

### 1. Done
- **Observer Background Service (`lib/interview/observer.ts`):**
  - Background evaluator using `gemini-2.5-flash-lite` analyzing whiteboard topology, C++ code snapshots, and recent transcript turns every 5–10 seconds.
  - Evaluates candidate state (`on_track`, `drifting`, `stuck`, `off_track`) against critical bottlenecks (50x spikes, outbox patterns, queue backpressure, race conditions).
- **Deterministic Policy Engine (`lib/interview/policy-engine.ts`):**
  - Enforces strict interjection rules: candidate silence >= 4s, cooldown >= 90s, frequency cap <= 4 per session, opening grace period >= 180s.
- **Spoken Injection Mechanism (`lib/interview/session-manager.ts`):**
  - Injects `[INTERNAL-OBSERVER]` steering instructions into the live session and emits visual cues (`observer.cue`) to the UI.

---

## Phase 6: Rubric Grader & Calibration Discrimination (2026-09-21)

### Status: Complete & Verified

### 1. Done
- **Post-Session Grader Engine (`lib/interview/grader.ts`):**
  - Grades completed sessions against 1–4 scale rubrics using `gemini-2.5-pro`.
  - Strictly enforces the Zero-Fabrication rule: every score cites verbatim transcript quotes or code snippets.
  - Generates comprehensive markdown dossiers in `data/interviews/<date>-<sessionId>.md`.
  - Persists structured dimension scores into SQLite `interview_scores`.
- **Calibration Discrimination Test Suite (`tests/phase6/calibration.test.ts`):**
  - Verified >= 1.0 point score separation between strong (>= 3.2) and weak (<= 2.2) calibration samples across System Design scenarios.
- **Interactive Scorecard UI (`app/interview/history/page.tsx`):**
  - Session detail modal showing rubric scorecards, evidence quotes, and on-demand grading trigger via `POST /api/interview/sessions/[id]/grade`.

---

## Phase 7: Hardening, Resumption & Documentation (2026-09-21)

### Status: Complete & Verified

### 1. Done
- **End-to-End Resilience & Zero-Regression Check:**
  - Full vitest suite: **27 test files, 127 tests passed** (100% pass rate).
  - Next.js build: **Compiled and statically optimized 12 pages with zero errors**.
  - ESLint: **0 warnings, 0 errors**.
  - Verified existing URL Evaluator (`/evaluate`), job tracker, and Kit studio operate with zero regressions.
- **Comprehensive Documentation:**
  - Created root `README.md` with complete installation, configuration, launch commands (`pnpm dev` + `pnpm interview:server`), and architectural sitemap.

