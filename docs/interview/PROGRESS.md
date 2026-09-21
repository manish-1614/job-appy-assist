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

### 2. Next Steps (Gate A)
- Human execution of the 5 manual AI Studio sessions per `manual-session-plan.md`.
- User feedback report on interviewer naturalness, probing quality, and voice cadence before Phase 3 backend code begins.

