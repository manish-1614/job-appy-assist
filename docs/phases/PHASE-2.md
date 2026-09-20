# Phase 2 — Constraint-Aware Scorer v2

> **Phase:** 2 (Constraint-Aware Scorer v2)  
> **Status:** Proposed / Ready for Execution  
> **Target Size:** L (Large)  
> **Author:** Antigravity  
> **Timestamp:** 2026-09-20  

---

## 1. Goal

Implement the constraint-aware Scorer v2 specified in Section 7 of `ANTIGRAVITY_MASTER_INSTRUCTION.md`. Replace noisy heuristics and unconstrained LLM point generation with a rigorous two-stage architecture:
1. **LLM extracts facts with quotes, code judges:** The LLM extracts structured facts with verbatim quotes; code verifies quotes and deterministically computes gates, sub-scores, and tiers.
2. **Hard constraints are gates, not points:** Gating roles on title exclusions, role family, location eligibility, compensation floor, and visa sponsorship.
3. **Zero fabrication:** Every extracted fact must be verified as a verbatim quote from the JD/location, or downgraded to `unknown`.
4. **Discriminative scoring:** Calibrate scores such that Tier A represents ≤ ~5% of jobs (only genuinely reachable, high-alignment opportunities).
5. **Auditable UI & Feedback:** Add an "Explain Fit & Audit" drawer panel showing gate results, 7 normalized sub-scores, and exact quotes; add 👍/👎 labeling on cards with reason codes for continuous calibration.

---

## 2. Technical Design & Architecture

### 2.1 Dependencies Justification
No new runtime dependencies are required. All LLM calls use the standard `fetch` API against Gemini Flash (or local Ollama). Parsing, regexes, and database interactions use existing `better-sqlite3`, `drizzle-orm`, and `cheerio`.

### 2.2 Database Schema Additions (`lib/db/schema.ts`)

Two new tables are added to SQLite:
1. **`job_extractions`**:
   - `jobId`: text primary key references `jobs.id` (cascade delete)
   - `contentHash`: text not null (SHA-256 of JD)
   - `promptVersion`: text not null (e.g. `v2.0`)
   - `model`: text not null (e.g. `gemini-2.5-flash` or `offline-rule`)
   - `extractedAt`: text not null (ISO timestamp)
   - `extractionStatus`: text not null (`success` | `failed`)
   - `extractedJson`: text not null (structured facts JSON)
   - `subScoresJson`: text (JSON with 7 sub-scores 0–1)
   - `tier`: text (`tier_a` | `tier_b` | `tier_c` | `gated`)
   - Unique index on `(contentHash, promptVersion, model)` for zero-cost caching.

2. **`job_labels`**:
   - `jobId`: text primary key references `jobs.id` (cascade delete)
   - `label`: text not null (`up` | `down`)
   - `reasonCode`: text not null (`good_match` | `bad_stack` | `not_remote` | `bad_location` | `overqualified` | `underqualified` | `low_comp` | `presales_heavy` | `other`)
   - `notes`: text
   - `labeledAt`: text not null

3. **`jobs` Table Synchronization**:
   - Keep `score`, `locationClass`, `gateReason`, `status`, `sponsorship`, `isRemote`, `salary` up to date from Scorer v2.

### 2.3 Fact Extraction & Quote Verification (`lib/scorer/`)

#### Extraction Schema (`ExtractedJobFacts`)
- `remoteScope`: `'worldwide' | 'apac' | 'india' | 'region_locked' | 'hybrid' | 'onsite' | 'unknown'`
- `allowedCountries`: `string[]`
- `excludedCountries`: `string[]`
- `tzOverlap`: `string | null`
- `engagement`: `'employee' | 'contractor' | 'eor' | 'unknown'`
- `salary`: `{ min?: number; max?: number; currency?: string; period?: string } | null`
- `visaSponsorship`: `'explicit' | 'none' | 'unknown'`
- `seniority`: `'junior' | 'mid' | 'senior' | 'staff_principal' | 'lead_manager' | 'unknown'`
- `roleFamily`: `'backend_distributed' | 'ai_agentic' | 'architect' | 'fullstack_backend' | 'frontend_only' | 'mobile_only' | 'data_science_pure' | 'unsupported'`
- `mustHaveTech`: `string[]`
- `niceToHaveTech`: `string[]`
- `yearsRequired`: `number | null`
- `domainTags`: `string[]`
- `presales`: `boolean`
- `quotes`: `Record<string, string | null>` (quote mapping per field)

#### Quote Verifier (`lib/scorer/quote-verifier.ts`)
- Code normalizes text (collapses whitespace, lowercases) and checks if the quote is a verbatim substring of the raw job description, location, or title.
- If quote is missing, empty, or not a verbatim substring:
  - Categorical fields drop to `'unknown'`.
  - Array fields (`mustHaveTech`, `allowedCountries`, etc.) filter out items lacking verbatim quotes.
  - Number fields (`yearsRequired`, `salary`) drop to `null`.
  - Guarantees project-wide zero-fabrication.

#### Caching & Concurrency
- Cache Key: `sha256(JD) + promptVersion + model`. If cached in `job_extractions`, reuse directly.
- Concurrency limiter: max 4 parallel requests with exponential backoff (1s, 2s, 4s).
- On failure: persist `extractionStatus: 'failed'`. Never silently substitute a heuristic score.

### 2.4 Deterministic Gates (`lib/scorer/gates.ts`)

All gates are evaluated deterministically in code:
1. **`G-role`**:
   - Seniority exclusions (word-boundary regex for junior, intern, trainee, entry-level, freshman).
   - Role family must be in `{ backend_distributed, ai_agentic, architect, fullstack_backend }` (D7).
   - `frontend_only`, `mobile_only`, `data_science_pure` are gated.
   - `presales`: flagged only, not gated (D6).
2. **`G-eligibility`**:
   - Location classified into `{ remote_worldwide, remote_apac_or_india, india_office, jp_kr_onsite_sponsored, region_locked, onsite_elsewhere, unknown }` (D2, D3).
   - Accepted India office cities (D3): Ranchi, Hyderabad, Pune, Gurgaon/Gurugram, Noida, New Delhi, Bengaluru, Mumbai.
   - Gate if `locationClass` is `region_locked` (allowed countries exclude India) or `onsite_elsewhere`.
   - Gate if timezone overlap requires daily hours during IST 00:00–05:00 (D5). Flag if > 4h US Pacific overlap.
   - If `unknown`: quarantined to `status: 'needs_check'`, never permitted into Tier A.
3. **`G-comp`**:
   - If stated salary max < Hard Floor INR 25 LPA (D1, FX converted), gate role (`gated:comp_floor`).
   - If salary unstated, pass gate as neutral.
4. **`G-sponsorship`**:
   - For Japan (Tokyo) / South Korea (Seoul) on-site roles (D8), requires `visaSponsorship === 'explicit'`; otherwise gated.

Stored `gateReason` format: `gated:role_family`, `gated:seniority_junior`, `gated:onsite_elsewhere`, `gated:region_locked`, `gated:comp_floor`, `gated:sponsorship_missing`, `gated:ist_hostile_tz`.

### 2.5 Deterministic Sub-scores (`lib/scorer/sub-scores.ts`)

Seven sub-scores (0.00 – 1.00) with weights per Section 7.3:
1. **`roleFit` (weight 0.30):**
   - Role family priority (backend/distributed = 1.0, AI/agentic = 0.95, architect = 0.85 [or 0.70 if presales], fullstack = 0.75).
   - Multiplied by title seniority match (Senior/Lead/Staff/Principal/Architect = 1.0, SWE = 0.85).
2. **`stackOverlap` (weight 0.20):**
   - Matched against candidate verified skills (`data/profile.json`).
   - Must-haves weighted 2× nice-to-haves. Word-boundary regex matching only.
3. **`reachability` (weight 0.15):**
   - Candidate experience (~8.5 years) vs `yearsRequired`.
   - 5–9 years: 1.0; 10–12 years: 0.85; 12–15 years: 0.60; 15+ years: 0.35.
   - Staff/Principal is not artificially boosted.
4. **`domainAffinity` (weight 0.10):**
   - Overlap with candidate domains: Telecom / BSS / OSS / CRM / Billing (Amdocs background), Japan-telecom (D8), AI Agents / Retrieval / Vector platforms (Smriti background).
5. **`freshness` (weight 0.10):**
   - 0–7 days: 1.0; 8–14 days: 0.85; 15–30 days: 0.70; 31–60 days: 0.50; 61–90 days: 0.30; > 90 days: 0.10 (ghost job penalty).
6. **`compFit` (weight 0.10):**
   - Position of stated range against soft target INR 35–65 LPA. Neutral (0.60) if unstated.
7. **`companySignal` (weight 0.05):**
   - Posting velocity and remote-first reputation boost.

Overall Score: `score = Math.round(100 * sum(w_i * s_i))`.

### 2.6 Tiers and Gating
- **Tier A (Top Fit):** Passed all gates, `score >= 75`, `locationClass !== 'unknown'`. Sent to Telegram, highlighted at top of dashboard.
- **Tier B (Qualifying):** Passed all gates, `60 <= score < 75`.
- **Tier C / Gated:** Failed any gate, or `score < 60`. Hidden by default, filterable, `gateReason` displayed.

### 2.7 Profile Hygiene (Section 7.5)
- Enhance `data/profile.json` candidate skills to adopt a `{ name: string, verified: boolean }` structure.
- Only skills with `verified: true` are counted during `stackOverlap` calculation and kit generation.

### 2.8 Evaluation Harness & Explain UI
1. **`pnpm eval` (`scripts/eval-harness.ts`):**
   - Command line harness that runs Scorer v2 across stored jobs.
   - Outputs:
     - Distribution of scores and tier breakdown (Tier A, Tier B, Tier C, Gated).
     - Gate failure breakdown.
     - Acceptance verification: Tier A ≤ ~5% of jobs; Tier A contains 0 jobs with `region_locked` or `onsite_elsewhere`.
     - Precision@10 and Precision@25 if labels are available in `job_labels`.
2. **Labeling API & UI (`/api/labels`):**
   - POST `/api/labels` records user 👍/👎 and reason code.
   - GET `/api/labels` retrieves feedback.
   - Interactive 👍/👎 buttons on job cards.
3. **"Explain Fit & Audit" Panel:**
   - Integrated into the slide-out job details drawer.
   - Displays:
     - Gate evaluation status and reason.
     - 7 sub-score breakdown with progress bars and numerical values.
     - Verbatim quote corroboration for extracted tech, remote status, location, and salary.

---

## 3. Task List

- [ ] **Task 2.0:** Create data snapshot in `data-backup/<timestamp>/`.
- [ ] **Task 2.1:** Update database schema (`lib/db/schema.ts`) with `job_extractions` and `job_labels`; run schema initialization.
- [ ] **Task 2.2:** Profile hygiene in `data/profile.json` (add `verified` model for core skills per Section 7.5).
- [ ] **Task 2.3:** Implement Quote Verifier (`lib/scorer/quote-verifier.ts`) with unit tests.
- [ ] **Task 2.4:** Implement Deterministic Gates (`lib/scorer/gates.ts`) with unit tests.
- [ ] **Task 2.5:** Implement Deterministic Sub-scores (`lib/scorer/sub-scores.ts`) with unit tests.
- [ ] **Task 2.6:** Implement Extraction Engine (`lib/scorer/extraction-engine.ts`) with Gemini Flash API, schema enforcement, caching, and offline fallback.
- [ ] **Task 2.7:** Implement unified Scorer v2 orchestrator (`lib/scorer/index.ts`).
- [ ] **Task 2.8:** Build offline evaluation harness (`scripts/eval-harness.ts`) and add `pnpm eval` script to `package.json`.
- [ ] **Task 2.9:** Implement Labeling API (`app/api/labels/route.ts`) and SQLite repository.
- [ ] **Task 2.10:** Update Dashboard UI (`app/page.tsx`):
  - Add 👍/👎 labeling with reason codes on job cards.
  - Add "Explain Fit & Audit" panel in the drawer showing gates, sub-scores, and verbatim quotes.
  - Filter / display tiers (Tier A, Tier B, Gated).
- [ ] **Task 2.11:** Run offline re-scoring across database, run tests, and verify acceptance criteria.
- [ ] **Task 2.12:** Author `docs/phases/PHASE-2-REPORT.md`.

---

## 4. Test Plan

1. **Quote Verifier Tests (`tests/phase2/quote-verifier.test.ts`):**
   - Verifies exact matches, whitespace normalization, casing normalization.
   - Rejects non-verbatim quotes, template strings, or ungrounded assertions.
2. **Deterministic Gates Tests (`tests/phase2/gates.test.ts`):**
   - Tests `G-role`: junior/intern filtered, backend/AI/architect passed, frontend-only/mobile-only gated, presales flagged.
   - Tests `G-eligibility`: remote worldwide / India passed; US-only or Europe-only gated (`region_locked`); Chicago/Seattle on-site gated (`onsite_elsewhere`); IST-hostile timezone gated; unknown location quarantined to `needs_check`.
   - Tests `G-comp`: stated max < INR 25L gated; unstated passes.
   - Tests `G-sponsorship`: Japan/Korea on-site requires explicit sponsorship.
3. **Sub-scores Tests (`tests/phase2/sub-scores.test.ts`):**
   - Validates weights (0.30, 0.20, 0.15, 0.10, 0.10, 0.10, 0.05).
   - Validates stack overlap against verified skills only.
   - Validates reachability curves and ghost-job penalties.
4. **Scorer v2 Integration Tests (`tests/phase2/scorer-v2.test.ts`):**
   - End-to-end scoring pipeline with mock/real fixtures.
   - Verifies zero raw LLM number influences the score.
5. **Acceptance Verification via `pnpm eval`:**
   - Tier A contains zero jobs with `eligibility in {region_locked, onsite_elsewhere}`.
   - Score distribution verified: Tier A ≤ ~5% of jobs.
   - Every stored fact has a quote or is `unknown`.

---

## 5. Rollback Plan

- Database: The new tables `job_extractions` and `job_labels` do not affect existing tables. Rolling back simply requires restoring `data/job_appy.db` from `data-backup/<timestamp>/`.
- Code: If Scorer v2 needs to be disabled, the ingestion scheduler and UI can fall back to existing `evaluateWithHeuristics` in `lib/ai-evaluator.ts`.
