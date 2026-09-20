# Phase 5 — Recall, Sources, and Insights

> **Phase:** 5 (Recall, Sources, and Insights)  
> **Status:** Proposed / Awaiting Approval  
> **Target Size:** M (Medium)  
> **Author:** Antigravity  
> **Timestamp:** 2026-09-20  

---

## 1. Goal

Address Recall Deficits and Source Diversity (Section 6 & Section 10 of `ANTIGRAVITY_MASTER_INSTRUCTION.md`):
1. **Automated Company Onboarding CLI (`pnpm add-company <careers-url>`):** Inspect arbitrary career pages, auto-detect ATS type (`greenhouse`, `lever`, `ashby`, `smartrecruiters`, `workable`, `recruitee`), extract company slug, verify against live API, and register in `sources` table and `companies.json`. Expose this in the UI.
2. **Expand Active Sources (≥ 30 verified sources):** Seed remote-first engineering employers (GitLab, Supabase, Linear, Elastic, Postman, Canonical, Grafana, Mozilla, Docker, etc.) resolving F14 (Datadog/Stripe watchlist skew).
3. **Employer Diversity Cap (≤ 20%):** Enforce strict company contribution ceilings in top views and feeds so no single employer occupies more than 20% of top recommendations.
4. **New Adapters:**
   - **Workable:** Public API endpoint integration (`https://apply.workable.com/api/v3/accounts/${slug}/jobs`).
   - **Recruitee:** Public API endpoint integration (`https://${slug}.recruitee.com/api/offers/`).
   - **Hacker News "Who is Hiring":** Algolia API ingest for monthly remote/visa-friendly engineering posts.
   - **Japan/Korea Track (D8):** TokyoDev and Japan Dev feeds for Tokyo/Seoul roles with sponsorship.
5. **Skill-Gap Insights Panel:** Aggregate extracted `mustHaveTech` and `niceToHaveTech` across all open Tier A and Tier B opportunities, compare against candidate's verified skills, and surface the highest-leverage missing skills.

---

## 2. Technical Design & Architecture

### 2.1 ATS Detection Engine (`lib/ats-detector.ts`)
* Given a target careers URL (e.g. `https://linear.app/careers` or `https://boards.greenhouse.io/gitlab`):
  1. Direct URL regex matching (`boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`, `jobs.ashbyhq.com/<slug>`, `apply.workable.com/<slug>`, `<slug>.recruitee.com`, `jobs.smartrecruiters.com/<slug>`).
  2. If custom domain, fetch page HTML with timeout (5s) and scan for embedded iframes, API endpoints, or script tags matching known ATS patterns.
  3. Validate candidate slug by making a ping to the respective ATS public API.
  4. Return `{ ats: AtsType, slug: string, companyName: string, confirmedJobCount: number }`.

### 2.2 CLI Tool (`scripts/add-company.ts`)
* Invocation: `pnpm add-company <careers-url>` (or `npx tsx scripts/add-company.ts <url>`).
* Discovers ATS, pings API, displays findings, and appends to SQLite `sources` and `data/companies.json`.

### 2.3 Additional ATS Adapters (`lib/ats-adapters.ts`)
* Extend `AtsType` to include `'workable'`, `'recruitee'`, `'hn'`, `'tokyodev'`, `'japandev'`.
* Implement `fetchWorkableJobs(slug, companyName)`.
* Implement `fetchRecruiteeJobs(slug, companyName)`.
* Implement `fetchHnJobs()`.
* Implement `fetchJapanKoreaJobs()`.

### 2.4 Employer Diversity Cap
* In `app/api/jobs/route.ts` and feed queries:
  * For any list of size $N$ (e.g. 50 jobs), ceiling per company is $\lfloor 0.20 \times N \rfloor$ (minimum 1).
  * Excess jobs from high-volume employers are deferred to subsequent pages or nested inside the distinct accordion, ensuring high diversity.

### 2.5 Skill-Gap Aggregator Engine (`lib/skill-gap.ts` & UI)
* Reads all open canonical jobs in SQLite where `tier IN ('tier_a', 'tier_b')` or `score >= 60`.
* Gathers `techStack` from `tech_stack_json` and extracted facts.
* Loads candidate profile verified skills via `getVerifiedSkills(profile)`.
* Computes:
  - Total occurrences of each tech skill across target jobs.
  - Matches vs. Gaps.
  - Returns top 15 missing skills ranked by frequency and impact.
* Integrated into `components/tracker/FunnelInsights.tsx` and a dedicated Skill Gap widget.

---

## 3. Task List

1. [ ] **Snapshot & Safety:** Create backup in `data-backup/<timestamp>/`.
2. [ ] **ATS Detector Module (`lib/ats-detector.ts`):**
   - Implement domain matching, iframe detection, and API validation for Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee.
3. [ ] **CLI Tool (`scripts/add-company.ts`):**
   - Add `add-company` script in `package.json`.
   - Provide interactive/CLI feedback.
4. [ ] **New Adapters (`lib/ats-adapters.ts`):**
   - Add Workable and Recruitee adapters with test fixtures.
   - Add HN Algolia and Japan/Korea ingest feeds.
5. [ ] **Seed Watchlist Expansion:**
   - Add verified remote-first engineering sources to reach ≥ 30 active sources.
6. [ ] **Employer Diversity Cap:**
   - Update `app/api/jobs/route.ts` to enforce ≤ 20% cap per employer.
7. [ ] **Skill-Gap Aggregator & API:**
   - Create `lib/skill-gap.ts`.
   - Add `/api/insights/skills` endpoint.
   - Embed Skill Gap Analyzer into the UI.
8. [ ] **Verification & Testing:**
   - Write tests for ATS detector, new adapters, diversity capping, and skill-gap aggregation.
   - Run `pnpm test`, `pnpm build`, `pnpm lint`.
9. [ ] **Phase 5 Report:** Authored at `docs/phases/PHASE-5-REPORT.md`.

---

## 4. Test Plan

* `tests/phase5/detector.test.ts`:
  - Verify regex and HTML detection for Greenhouse, Lever, Ashby, Workable, Recruitee.
* `tests/phase5/diversity.test.ts`:
  - Verify that a dataset with 40 Datadog jobs and 10 other jobs results in Datadog occupying at most 20% (10/50) of the top list.
* `tests/phase5/skill-gap.test.ts`:
  - Verify extraction and ranking of missing skills against verified profile skills.
* `tests/phase5/adapters.test.ts`:
  - Unit test parsing of Workable, Recruitee, and JapanDev fixtures.

---

## 5. Rollback Plan

All changes are additive. If any adapter or detector fails, existing sources and scanner workflows remain operational. In case of unexpected behavior, revert git commit and restore snapshot from `data-backup/`.
