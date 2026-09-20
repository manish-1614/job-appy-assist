# Phase 0 Report — Safety Net and Hygiene

> **Phase:** 0 (Safety Net & Hygiene)  
> **Status:** Complete  
> **Date:** 2026-09-20  
> **Author:** Antigravity  

---

## 1. What Changed

### Files Modified & Created
* **Dependencies (`package.json`, `pnpm-lock.yaml`):**
  * Added `vitest` (v5.0.1) as `devDependency`.
    * *Why:* Fast, native ESM runner with TypeScript support and zero-config compatibility for Next.js unit and characterization testing.
  * Added `"test": "vitest run"` and `"test:watch": "vitest"`.
  * Updated `"dev": "next dev -H 127.0.0.1"` and `"start": "next start -H 127.0.0.1"` to restrict dev/prod servers strictly to local loopback interface.
* **Test Configuration & Harness (`vitest.config.mts`, `tests/characterization/*`):**
  * Created `vitest.config.mts` with `@/` path alias mapping.
  * Created characterization test suites:
    * `tests/characterization/dedup.test.ts` (URL canonicalization, tracking param stripping, baseline `gh_jid` stripping, title normalization, and 2-tier dedup).
    * `tests/characterization/gate.test.ts` (deterministic gate testing and baseline substring match behavior).
    * `tests/characterization/heuristics.test.ts` (scoring heuristics, baseline salary string fabrication, and Tokyo sponsorship assumption).
    * `tests/characterization/telegram.test.ts` (Telegram HTML formatting and entity escaping).
* **Data Privacy & Git Hygiene (`.gitignore`, git index):**
  * Updated `.gitignore` to ignore `/data/`, `/data-backup/`, `*.pdf`, `*.docx`, `.env*`, and SQLite database files (`*.db`, `*.sqlite*`).
  * Removed `data/` from git tracking index via `git rm -r --cached data`.
  * Created a timestamped snapshot backup of `data/` in `data-backup/2026-09-20T16-30-00/`.
* **Security & Operational Fixes (`lib/ai-evaluator.ts`, `lib/telegram.ts`, `tsconfig.json`, `app/api/jobs/route.ts`):**
  * `lib/ai-evaluator.ts`: Moved Gemini API key transmission from query parameter (`?key=...`) to `x-goog-api-key` HTTP header.
  * `lib/telegram.ts`: Implemented `escapeHtml` and converted Telegram digest formatting from `parse_mode: 'Markdown'` to `parse_mode: 'HTML'`, preventing unescaped markdown syntax errors during dispatch.
  * `tsconfig.json` & `app/api/jobs/route.ts`: Added `"target": "es2020"` and safe iterator mapping to ensure robust TypeScript compilation and downlevel iteration support.
* **Master Documentation (`GEMINI.md`, `docs/phases/PHASE-0.md`):**
  * Synchronized Sections 1–5 of `ANTIGRAVITY_MASTER_INSTRUCTION.md` into `GEMINI.md`.
  * Reconciled Decision D1 (Hard floor INR 25L from `data/profile.json`, removing conflicting 35L floor).

---

## 2. Evidence

### Test Execution
Ran `pnpm test` (`vitest run`):
```text
 ✓ tests/characterization/dedup.test.ts (9 tests) 5ms
 ✓ tests/characterization/heuristics.test.ts (3 tests) 4ms
 ✓ tests/characterization/telegram.test.ts (4 tests) 19ms
 ✓ tests/characterization/gate.test.ts (3 tests) 3ms

 Test Files  4 passed (4)
      Tests  19 passed (19)
   Duration  3.57s
```

### Build & Lint Validation
* `pnpm lint`: Zero ESLint errors or warnings.
* `pnpm build`: Optimized Next.js production build generated successfully (all static and dynamic routes compiled).

### Git Hygiene Audit (F19 Verification)
* `git ls-files data`: Output is completely empty. `data/profile.json` (containing phone, email, and salary targets) is no longer tracked in the repository.
* Local files in `data/` and `data-backup/2026-09-20T16-30-00/` remain intact on disk.

### Baseline Findings Characterized
* **F1 (Stripe URL Collapse):** Verified in `dedup.test.ts` that `canonicalizeUrl` currently strips `gh_jid`, collapsing distinct job postings.
* **F2 (Substring Gate Drop):** Verified in `gate.test.ts` that `passesDeterministicGate` currently drops "Internal Tools" titles due to `'intern'` substring check.
* **F13 (Fabricated Fields):** Verified in `heuristics.test.ts` that baseline heuristic assigns synthetic salary strings and infers explicit sponsorship from Tokyo location alone.
* **F18 (Telegram Send Failure):** Verified in `telegram.test.ts` that HTML escaping and `parse_mode: 'HTML'` protect against unescaped markdown symbols.

---

## 3. Behavior Changes the User Will Notice

1. `pnpm dev` now strictly binds to `127.0.0.1` (no listening on 0.0.0.0 / local area network).
2. Telegram bot digests will use HTML tags instead of Markdown, preventing broken messages or silent delivery failures for titles with special characters (`_`, `*`, `[`, etc.).
3. When Gemini API is invoked, the API key is passed securely in HTTP headers rather than exposed in query strings and HTTP request URLs.
4. `pnpm test` is now available as a standard command to run regression and characterization tests.

---

## 4. Known Gaps / Risks

1. Findings F1 through F17 remain to be resolved in Phase 1 and Phase 2 (Phase 0 only pins them down with characterization tests and establishes safety guards).
2. Git history prior to this commit still contains the earlier tracked `data/` commits.

---

## 5. Manual Steps for the User

1. **Make Repository Private & Rotate Secrets:**
   * Because `data/profile.json` was previously tracked in git history, ensure the GitHub repository `manish-1614/job-appy-assist` is set to **Private**.
   * If any sensitive API keys or tokens were previously committed or exposed, rotate them.
2. *(Optional)* If you wish to scrub historical git commits containing `data/profile.json`, run git filter-repo or push the cleaned tree to a fresh repository.

---

## 6. Open Questions and [DECISION] Items

* All Decisions D1 through D11 are confirmed with their defaults documented in `GEMINI.md`.
* Decision D1 is implemented: hard floor is INR 25L, soft target is 35–65L.

---

## 7. Proposed Next-Phase Scope: Phase 1 (Correctness and Storage)

Phase 1 addresses the core data layer, identity, lifecycle, dedup, and SQLite migration:
1. **Identity & Canonical URL (F1):** Primary key `(ats, slug, externalId)`. Retain `gh_jid` in Greenhouse URLs; strip only tracking query params.
2. **Deterministic Gate v2 (F2):** Word-boundary regex (`\bintern\b`) so "Internal Tools" passes; add role-family classifier stub.
3. **SQLite + Drizzle Engine (D10, F4, F12):** Replace JSON storage with `better-sqlite3` and Drizzle schema (`jobs`, `job_descriptions`, `job_events`, `sources`, `runs`, `applications`). Idempotent migration of `data/jobs.json` with backfill of missing timestamps/status for 1,386 legacy rows.
4. **JD Persistence (F4):** Persist cleaned description text and sha256 content hash for every job.
5. **Job Lifecycle (F5, F6):** Update `lastSeenAt` on every scan sighting; close jobs only after 2 consecutive missing scans; handle source failures (>50% drop) without closing jobs; record `reopened` events.
6. **Freshness (F15):** Capture ATS published timestamps and calculate days since posted.
7. **Dedup v2 (F11):** Seniority-aware similarity matching restricted within same company and location set.
8. **RSS Normalization (F10):** Mark location `unknown` if no region present (never `'Remote / Global'`).
9. **Ops (F16, F18):** File lock to prevent overlapping runs, Windows Task Scheduler script (`scripts/install-schedule.cmd`), real `sourcesChecked` metrics.
