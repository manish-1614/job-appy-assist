# Phase 0 — Reconnaissance & Technical Audit

**Date:** 2026-09-21  
**Project:** JobAppy Assist — Mock-Interview Voice Module & URL Evaluator Extraction  
**Author:** Pair Programming Assistant (Antigravity) & Candidate (Manish Kumar Prajapati)

---

## 1. Executive Summary

This reconnaissance report audits the current architecture, data flows, routing conventions, and operational patterns of the `job-appy-assist` repository. It provides ground truth for implementing:
1. **The isolated "Evaluate Any Job Opening URL" sidebar menu & page (Phase 1).**
2. **The multimodal Gemini Live Voice Mock-Interview system (Phases 2–7).**

---

## 2. Technical Audit Findings

### 2.1 Navigation, Routing & Sidebar Architecture
- **Framework:** Next.js 14.2.5 (App Router, React 18.3.1, Tailwind CSS).
- **Layout Shell:** [`app/layout.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/layout.tsx) is a minimal root wrapper providing metadata, fonts, background glow orbs (`bg-glow-orb-1`, `bg-glow-orb-2`), and rendering `{children}`.
- **Main View / Sidebar:** [`app/page.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/page.tsx) is currently a monolithic client component (`'use client'`) containing:
  - An `<aside>` sidebar (lines 652–820) with hardcoded state buttons that mutate `activeTab` (`'today'`, `'fresh'`, `'all'`, `'pipeline'`, `'insights'`, `'review'`, `'watchlist'`, `'profile'`, `'runs'`).
  - Currently, there are no nested layout components or shared sidebar components; navigation is purely internal state driven.
- **Routing Opportunity:** To add a dedicated route `/evaluate` and `/interview`, navigation should be made data-driven and shared via a standalone sidebar component or layout pattern, supporting both in-page tab switches on `/` and standard Next.js route navigation with active-route highlighting.

### 2.2 Existing Job Opening URL Evaluator
- **UI Entry Point:** [`app/page.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/page.tsx) (lines 928–1153) contains the `<section>` titled "MANUAL JOB URL EVALUATOR BAR" and the corresponding "EVALUATED MATCH RESULT CARD".
- **Client Handler:** `handleManualUrlEvaluation` (`app/page.tsx:599-623`) invokes `POST /api/eval/url`. A secondary handler `handleSaveEvaluatedJob` (`app/page.tsx:625-646`) invokes `POST /api/eval/url` with `{ saveToJobs: true }`.
- **API Route:** [`app/api/eval/url/route.ts`](file:///C:/Luminary/Projects/job-appy-assist/app/api/eval/url/route.ts) (dynamic POST route).
- **Core Engine:** [`lib/url-evaluator.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/url-evaluator.ts):
  - `fetchJobFromUrl(targetUrl)`: Cheerio-based web scraper with specialized handlers for Greenhouse (`boards-api.greenhouse.io`), Lever, Ashby, and SmartRecruiters, falling back to clean HTML content extraction.
  - `evaluateTargetJobUrl(targetUrl, saveToJobs)`: Loads candidate profile from `data/profile.json`, executes semantic LLM evaluation (`evaluateJobWithLLM`), and computes deterministic sub-scores (`computeSubScoresV2`).
- **Response Contract (`UrlEvaluationResponse`):**
  ```typescript
  export interface UrlEvaluationResponse {
    success: boolean;
    rawPosting?: RawJobPosting;
    evaluation?: AiEvaluationResult;
    evaluatedJob?: EvaluatedJob;
    saved?: boolean;
    error?: string;
  }
  ```
  `evaluatedJob` includes canonical attributes: `id`, `title`, `company`, `location`, `canonicalUrl`, `applyUrl`, `score` (0–100), `matchReason`, `evidence`, `sponsorship`, `isRemote`, `techStack`, and `tier`.
- **Phase 1 Strategy:** Extract this into a dedicated page at [`app/evaluate/page.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/evaluate/page.tsx) with a dedicated sidebar entry "Evaluate Any Job Opening URL", maintaining exact API and scoring contract without duplication.

### 2.3 Database & Storage Layer
- **Dual Storage Reality:**
  - **SQLite via Drizzle (`better-sqlite3`):** Active primary store configured in [`lib/db/index.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/db/index.ts) pointing to [`data/job_appy.db`](file:///C:/Luminary/Projects/job-appy-assist/data/job_appy.db). Enabled with WAL mode, foreign keys, and 15s busy timeout.
  - **Auto-Migrations / Schema Init:** `initDb()` in `lib/db/index.ts` creates tables idempotently (`CREATE TABLE IF NOT EXISTS`) and applies schema updates using SQLite PRAGMA checks and `ALTER TABLE ADD COLUMN`. Drizzle schema is declared in [`lib/db/schema.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/db/schema.ts).
  - **Legacy Neon/Postgres Path:** Configured in [`lib/db-neon.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/db-neon.ts) and [`lib/schema.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/schema.ts). Per GEMINI.md Decision D10, this path is frozen and not used for active runtime storage.
  - **Local JSON:** `data/profile.json` (verified candidate profile), `data/jobs.json` (canonical jobs backup/export), `data/companies.json`, `data/runs.json`.
- **Interview Storage Plan:** New tables (`interview_sessions`, `interview_turns`, `interview_events`, `interview_snapshots`, `interview_scores`, `interview_usage`) will follow the SQLite/Drizzle pattern in `lib/db/`, paired with markdown session export under `data/interviews/<date>-<id>.md`.

### 2.4 WebSocket & Custom-Server Audit
- **Existing WebSocket Usage:** None exists in the codebase.
- **Next.js 14 Constraint:** Next.js Route Handlers (`app/api/...`) run on edge/serverless-like request-response abstractions and cannot maintain stateful duplex WebSockets.
- **Process Layout:** A dedicated server-side proxy process running on TypeScript via `tsx` (e.g. `scripts/interview-server.ts`, launched with `pnpm interview:server`) is necessary. It binds to `127.0.0.1:${INTERVIEW_SERVER_PORT || 4001}`, hosts a WebSocket server for the browser, and communicates upstream with Google's Gemini Live WebSocket endpoint.

### 2.5 Environment & Security
- **Config & Secrets:** Read through `process.env` from `.env.local`. Handled server-side only. No client-exposed keys (`NEXT_PUBLIC_` is strictly forbidden for API keys).
- **Gemini Key:** `GEMINI_API_KEY` (or fallback `GOOGLE_API_KEY`) is used on a paid tier.
- **Local Isolation:** All servers bind strictly to `127.0.0.1` / `localhost`.

### 2.6 Test Runner & Linting
- **Test Runner:** `vitest` v5.0.1 configured in [`vitest.config.mts`](file:///C:/Luminary/Projects/job-appy-assist/vitest.config.mts) with `node` environment, `globals: true`, and `@` path alias. Full test suite executes 22 files / 98 tests passing in ~25 seconds.
- **Linting:** ESLint 8.57.0 with `eslint-config-next` (`next lint`). Currently passes cleanly with 0 warnings/errors.

---

## 3. Risks & Mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| **R1** | Next.js cannot hold persistent WebSockets in Route Handlers | Real-time audio streaming fails if placed in Next.js routes | Standalone Node/TS process (`pnpm interview:server`) on `127.0.0.1:4001` using standard `ws` package. |
| **R2** | Gemini Live session disconnects or issues `GoAway` after idle period or limit | Candidate voice interview interrupted unexpectedly | Enable session resumption tokens in `@google/genai` Live config; handle `GoAway` by automatically restoring session handle and sliding context window. |
| **R3** | High token usage from streaming audio & frequent diagram/code snapshots | Budget blowouts | Enforce hard budget caps (ADR-004), sliding context window compression, and content-hash gating on Monaco/Excalidraw updates (only send when digest hash changes). |
| **R4** | Observer interruptions talk over the candidate or feel unnatural | Annoying interview experience | Strict deterministic policy engine: VAD silence check (≥4s after candidate finishes speaking), cooldown (≥90s), probe counter, and single-shot internal prompt injection. |
| **R5** | Excalidraw SSR breakdown in Next.js 14 | Next.js build / render error on `window` or canvas | Load Excalidraw dynamically with `ssr: false` in client component only. |
