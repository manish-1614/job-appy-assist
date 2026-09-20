# Phase 2 Report — Constraint-Aware Scorer v2

## 1. What Changed

### Files Modified & Created
* **Architecture & Scorer Engine:**
  * `lib/scorer/types.ts`: Defined domain types for extracted facts, verbatim quotes, deterministic gates, sub-scores, tiers, and label reasons.
  * `lib/scorer/quote-verifier.ts`: Strict zero-fabrication verifier ensuring every extracted fact (title, roleFamily, seniority, location, comp, tech, etc.) maps directly to a case/whitespace-normalized verbatim substring in JD text or location, downgrading to `unknown` / `null` on failure.
  * `lib/scorer/gates.ts`: Pure deterministic gates enforcing G-role (seniority & non-engineering exclusions, presales tagging), G-eligibility (D2/D3 location classes, IST-hostile timezone ceiling D5), G-comp (INR 25L floor per D1), and G-sponsorship (explicit requirement for JP/KR track per D8).
  * `lib/scorer/sub-scores.ts`: Pure deterministic weighted sub-scoring (Role Fit 0.30, Stack Overlap 0.20 against verified skills only, Reachability 0.15, Domain Affinity 0.10, Freshness 0.10, Comp Fit 0.10, Company Signal 0.05) and tier classification (Tier A: ≥75 & un-gated, Tier B: 60–74 & un-gated, Tier C / Gated: <60 or gated).
  * `lib/scorer/extraction-engine.ts`: Structured Gemini Flash extraction with caching in SQLite `job_extractions` keyed by `(jd_hash, prompt_version, model)`, alongside an offline heuristic fallback extractor with verbatim quote capture.
  * `lib/scorer/index.ts`: Orchestrator combining extraction, quote verification, gates, and sub-scores (`scoreJobV2` & `rescoreJobInDb`).
* **Database & Migrations:**
  * `lib/db/schema.ts` & `lib/db/index.ts`: Added `tier`, `subScoresJson`, `extractedFactsJson` to `jobs` table; added `job_extractions` (caching prompt hashes) and `job_labels` (user calibration feedback) tables.
* **Calibration & Feedback:**
  * `lib/labels.ts` & `app/api/labels/route.ts`: API endpoints for saving and retrieving candidate calibration feedback (👍/👎 with specific error codes: `bad_stack`, `not_remote`, `bad_location`, `overqualified`, `underqualified`, `low_comp`, `presales_heavy`, `other`).
* **Evaluation Harness & Scheduler:**
  * `scripts/eval-harness.ts`: Offline rescoring and evaluation command (`pnpm eval`) reporting score distribution, tier breakdowns, constraint audit, and calibration precision.
  * `scripts/scheduler.ts`: Integrated `scoreJobV2` for newly ingested jobs; restricted Telegram notifications strictly to Tier A roles.
* **UI & Drawer:**
  * `app/page.tsx`: Updated metrics cards (Tier A, Tier B, Gated counts), tier filter tabs ("All Qualifying", "Tier A Top Fit", "Tier B", "Gated"), card badges with inline 👍/👎 label trigger, and comprehensive "Explain Fit & Audit" panel in the slide-over drawer showing gate checklists, 7 sub-score bars, verbatim quote audit, and feedback rating widget.
* **Testing & Profile:**
  * `data/profile.json` & `lib/storage.ts`: Upgraded candidate skills into verified structure (`{ name, verified: true }`); added `getVerifiedSkills()`.
  * `tests/phase2/quote-verifier.test.ts`: 4 tests for verbatim substring checks and downgrading unverified quotes.
  * `tests/phase2/gates.test.ts`: 15 tests covering role boundaries, presales flags, geographic gates (D2, D3), comp floor (D1), and Japan/Korea sponsorship (D8).
  * `tests/phase2/sub-scores.test.ts`: 7 tests verifying verified-skill overlaps, weight balancing, and tier thresholds.
  * `tests/phase2/scorer-v2.test.ts`: 3 integration tests verifying database rescoring and end-to-end scoring pipeline.

### Dependencies Added
* None. All implementation was executed using existing project dependencies (`better-sqlite3`, `drizzle-orm`, `@google/genai`, `vitest`).

---

## 2. Evidence & Audit Results

### Test Execution
* Full test suite run: **14 test files passed, 69 total tests passed, 0 failures**.
```
 ✓ tests/phase1/db.test.ts (2 tests)
 ✓ tests/phase1/api.test.ts (3 tests)
 ✓ tests/characterization/telegram.test.ts (4 tests)
 ✓ tests/phase1/lifecycle.test.ts (5 tests)
 ✓ tests/phase1/second_scan_stripe.test.ts (1 test)
 ✓ tests/phase2/scorer-v2.test.ts (3 tests)
 ✓ tests/phase2/gates.test.ts (15 tests)
 ✓ tests/phase2/quote-verifier.test.ts (4 tests)
 ✓ tests/characterization/dedup.test.ts (9 tests)
 ✓ tests/phase1/regression.test.ts (5 tests)
 ✓ tests/phase1/migration.test.ts (5 tests)
 ✓ tests/phase2/sub-scores.test.ts (7 tests)
 ✓ tests/characterization/heuristics.test.ts (3 tests)
 ✓ tests/characterization/gate.test.ts (3 tests)

 Test Files  14 passed (14)
      Tests  69 passed (69)
```

### Ground-Truth Score Distribution (`pnpm eval`)
Offline re-evaluation of all **2,074 stored jobs** yielded:

| Metric | Legacy Scorer (Section 3 Findings F7, F8) | Scorer v2 (Audited Actual) | Target / Acceptance Criteria |
|---|---|---|---|
| **Median Score** | 71.0 (inflated base 65 + keyword boost) | 35.0 (un-inflated, gated roles 0) | Discriminative scoring |
| **Top Tier (≥75 / Tier A)** | 347 jobs ≥ 90 (17.5% noise) | **11 jobs (0.5%)** | ≤ ~5% of jobs |
| **Middle Tier (60–74 / Tier B)** | 993 jobs ≥ 70 (50.2%) | **155 jobs (7.5%)** | Moderate high-fit queue |
| **Gated / Tier C (<60 or failed gate)** | 0 jobs gated | **1,908 jobs (92.0%)** | Hard gate filters unreachable roles |
| **Unreachable Roles in Tier A** | 283 of 492 jobs ≥85 on-site outside India/JP/KR | **0 jobs** (0 violations) | **0%** unreachable in Tier A |
| **Raw LLM numbers deciding score** | F3: LLM deep-eval or heuristic boilerplate | **0 raw LLM numbers** | Pure deterministic evaluation |

---

## 3. Behavior Changes the User Will Notice

1. **Clean Main Feed:** Instead of 1,000+ noisy roles scoring 70–90, the main view defaults to qualifying roles, highlighting the top 11 Tier-A openings that strictly honor candidate constraints.
2. **Tier Filtering:** Easy toggle between "All Qualifying" (Tier A + Tier B), "Tier A Top Fit", "Tier B", and "Gated" roles.
3. **Explain Fit & Audit Panel:** Clicking any job card opens the drawer with an "EXPLAIN FIT & AUDIT" breakdown:
   - Status of all deterministic gates with stored reason codes.
   - 7 transparent sub-score progress bars (Role fit, Stack overlap against verified skills, Reachability, Domain affinity, Freshness, Comp fit, Company signal).
   - Verbatim quotes extracted directly from the job posting.
4. **Interactive Calibration Feedback:** Quick 👍 / 👎 buttons directly on job cards and in the drawer. Clicking 👎 prompts a modal to specify the exact reason (e.g. `bad_stack`, `not_remote`, `presales_heavy`), tracking candidate feedback in `job_labels`.
5. **Quiet Telegram Alerts:** Notifications only trigger when a true Tier A role is detected during ingestion.

---

## 4. Known Gaps / Risks

1. **LLM Extraction Quotas:** Deep extraction requires Gemini Flash API calls. To prevent rate-limiting and unexpected costs during massive backfills, the harness operates with an offline heuristic fallback when `GEMINI_API_KEY` is not present, and caches extractions in `job_extractions` indefinitely by JD content hash.
2. **Calibration Threshold:** Master instruction recommends ≥60 candidate feedback labels before altering sub-score weights. Current label count is 0.

---

## 5. Manual Steps for the User

1. **Verify or Extend Candidate Skills:** Ensure any newly targeted skills in `data/profile.json` have `"verified": true` in the achievement bank before they are scored in `stackOverlap`.
2. **Rate Jobs in UI:** As you browse jobs, use the 👍/👎 buttons to rate 20–30 roles so the calibration harness can report precision metrics in `pnpm eval`.

---

## 6. Open Questions & Decision Items

* None. All Phase 2 decisions (D1 comp floor, D2 location classes, D3 India cities, D5 timezone rules, D7 role family priorities, D8 Japan/Korea sponsorship) have been implemented and tested.

---

## 7. Proposed Next-Phase Scope: Phase 3 — Application Tracker and Follow-ups

Phase 3 will turn `job-appy-assist` into an actionable workflow engine:
1. **Pipeline (Kanban) View:** Interactive stages (`Saved`, `Tailoring`, `Applied`, `Interviewing`, `Offer`, `Rejected`, `Ghosted`).
2. **Today View:** Actionable daily dashboard with follow-ups due, weekly goal progress (10 applications/week per D11), and closing risks.
3. **Application Events & Tracking:** `applications` and `application_events` tables in SQLite; one-click "Applied" status transition; follow-up reminder cadences (e.g. Day 5, Day 12).
4. **Lifecycle Protection:** Prevent background scans from overwriting user application tracker fields; raise alerts if a job with an active application is closed by the employer.
