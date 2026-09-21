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
- None. Phase 1 is complete and ready for Phase 2.
