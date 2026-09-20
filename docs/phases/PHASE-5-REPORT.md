# Phase 5 Report — Recall, Sources, and Insights

## 1. What Changed

### Files Created & Modified
* **Automated Company Onboarding & ATS Detector:**
  * `lib/ats-detector.ts`: High-accuracy ATS detection engine inspecting hosted ATS URLs, custom careers page HTML, iframes, API endpoints, and script widgets across Greenhouse, Lever, Ashby, SmartRecruiters, Workable, and Recruitee.
  * `scripts/add-company.ts`: CLI onboarding tool (`pnpm add-company <careers-url>`) providing instant discovery, validation, and automated persistence into SQLite `sources` table and `data/companies.json`.
  * `app/api/companies/route.ts`: Enhanced POST handler with automatic ATS detection from arbitrary `careersUrl`.
  * `package.json`: Added `"add-company": "node ./node_modules/tsx/dist/cli.mjs scripts/add-company.ts"`.
* **Extended ATS Adapters:**
  * `lib/ats-adapters.ts`:
    * Extended `AtsType` to support `workable`, `recruitee`, `hn`, `tokyodev`, `japandev`.
    * Implemented `fetchWorkableJobs(slug, companyName)` via Workable's lightweight public widget API.
    * Implemented `fetchRecruiteeJobs(slug, companyName)` via Recruitee's public offers API.
    * Implemented `fetchHnJobs()` via Algolia API fetching the latest monthly "Ask HN: Who is hiring?" thread.
    * Implemented `fetchJapanKoreaJobs(type, companyName)` ingesting bilingual tech feeds for Tokyo and Seoul opportunities.
* **Shortlist Expansion (F14 Resolution):**
  * `scripts/seed-sources.ts`: Seeded watchlist expansion from 14 to **35 active sources**, bringing in top remote-first engineering employers (GitLab, Supabase, Linear, Elastic, Postman, Canonical, Docker, Grafana Labs, Mozilla, MongoDB, Cloudflare, Snyk, GitHub, Resend, Monzo, Hacker News, TokyoDev, Japan Dev).
* **Employer Diversity Cap:**
  * `lib/diversity.ts`: Enforces strict maximum employer contribution ceiling (default $\le 20\%$) in recommendations and feeds, preventing Datadog/Stripe dominance.
  * `app/api/jobs/route.ts`: Integrated `applyEmployerDiversityCap` for feed queries with `capDiversity=true`.
* **Skill-Gap Aggregator Engine & UI:**
  * `lib/skill-gap.ts`: Real-time market demand analyzer aggregating `mustHaveTech` across all open Tier A and Tier B opportunities against candidate's verified skills (`profile.json`). Computes frequency, missing rate, and candidate stack coverage.
  * `app/api/insights/skills/route.ts`: Dynamic endpoint serving aggregated skill gaps.
  * `components/tracker/SkillGapPanel.tsx`: Interactive dashboard panel visualizing top missing skills, demand counts, sample hiring employers, and verified stack coverage.
  * `components/tracker/FunnelInsights.tsx`: Embedded `SkillGapPanel` into the Insights tab.
* **Testing:**
  * `tests/phase5/detector.test.ts`: 9 unit tests for URL and HTML ATS detection.
  * `tests/phase5/adapters.test.ts`: 2 integration tests for Workable and Recruitee adapters.
  * `tests/phase5/diversity.test.ts`: 2 tests verifying strict $\le 20\%$ employer capping.
  * `tests/phase5/skill-gap.test.ts`: Unit test for skill gap calculation across Tier A/B opportunities.
  * `tests/phase5/sources.test.ts`: Acceptance test verifying $\ge 30$ active sources and ATS diversity.

### Dependencies Added
* None. All implementation utilized existing project dependencies.

---

## 2. Evidence & Audit Results

### Test Suite Execution (`vitest`)
Ran `pnpm test`: **22 test files passed, 98 total tests passed, 0 failures**.
```
 ✓ tests/phase4/tailor.test.ts (2 tests)
 ✓ tests/phase1/db.test.ts (2 tests)
 ✓ tests/phase3/applications.test.ts (6 tests)
 ✓ tests/phase1/api.test.ts (3 tests)
 ✓ tests/phase1/lifecycle.test.ts (5 tests)
 ✓ tests/characterization/telegram.test.ts (4 tests)
 ✓ tests/phase1/second_scan_stripe.test.ts (1 test)
 ✓ tests/phase2/scorer-v2.test.ts (3 tests)
 ✓ tests/phase2/gates.test.ts (15 tests)
 ✓ tests/phase2/sub-scores.test.ts (7 tests)
 ✓ tests/phase4/validator.test.ts (6 tests)
 ✓ tests/characterization/dedup.test.ts (9 tests)
 ✓ tests/phase5/detector.test.ts (9 tests)
 ✓ tests/phase1/regression.test.ts (5 tests)
 ✓ tests/phase1/migration.test.ts (5 tests)
 ✓ tests/phase2/quote-verifier.test.ts (4 tests)
 ✓ tests/phase5/adapters.test.ts (2 tests)
 ✓ tests/phase5/diversity.test.ts (2 tests)
 ✓ tests/characterization/heuristics.test.ts (3 tests)
 ✓ tests/phase5/skill-gap.test.ts (1 test)
 ✓ tests/characterization/gate.test.ts (3 tests)
 ✓ tests/phase5/sources.test.ts (1 test)

 Test Files  22 passed (22)
      Tests  98 passed (98)
```

### Build & Lint Verification
* `pnpm build`: Completed successfully with 0 errors across all 21 routes.
* `pnpm lint`: Completed successfully with 0 warnings or errors.

### Watchlist & Diversity Audit Against Section 3 Findings
| Metric | Before Phase 5 (Ground Truth) | After Phase 5 |
|---|---|---|
| Active Watchlist Sources | 14 sources (F14 skew: Datadog + Stripe = 56%) | **35 active sources** (GitLab, Supabase, Postman, Elastic, Docker, Grafana, Resend, Monzo, etc.) |
| Max Employer Share in Top Capped Feed | Up to 100% (monopolized by Datadog) | Strictly capped at **$\le 20\%$** per company |
| Onboarding Friction | Manual JSON editing | 1-click CLI: `pnpm add-company <careers-url>` with auto-detection |
| Market Skill Gap Insights | 0 (hidden) | Aggregated from real Tier A/B data in dedicated Skill Gap Panel |

---

## 3. Behavior Changes the User Will Notice

1. **One-Command Onboarding:** Simply run `pnpm add-company https://linear.app/careers` or paste any career page URL to onboard new employers. The system detects the ATS, checks the API, and persists the source.
2. **Balanced Discovery Feed:** No single company can overwhelm your recommendations. In feeds of 50 jobs, Datadog or Stripe are capped at a maximum of 10 jobs (20%), allowing diverse opportunities from GitLab, Supabase, Vercel, and others to surface.
3. **Market Skill Gap Analyzer in Insights:** Opening the "Insights" tab reveals the Market Skill Gap & Demand Analyzer. It shows:
   - High-demand technologies in Tier A/B roles missing from your verified profile (e.g. Kubernetes, Go, Terraform) to target your interview prep.
   - Verified profile skills that are in highest market demand.
   - Percentage of target jobs requiring each skill.
4. **Bilingual Japan/Korea Tech Track:** TokyoDev and Japan Dev feeds ingested when Japan/Korea relocation track is engaged.

---

## 4. Known Gaps / Risks

1. **Custom ATS Pages:** Highly obfuscated Single Page Apps (SPAs) without standard metadata or script tags may require entering the direct hosted ATS URL (e.g., `boards.greenhouse.io/<slug>`).

---

## 5. Manual Steps for the User

1. **Onboard Favorite Companies:** Run `pnpm add-company <careers-url>` for any additional remote-first companies you would like to track.
2. **Review Skill Gaps:** Open the Insights tab to see which skills appear most frequently across Tier A and Tier B openings.

---

## 6. Open Questions & Decision Items

* None. All core phases (Phase 0 through Phase 5) of `ANTIGRAVITY_MASTER_INSTRUCTION.md` are now fully implemented, verified, and operational. Phase 6 remains an optional future inbound signal extension.

---

## 7. Master Instruction Status

All core phases of `ANTIGRAVITY_MASTER_INSTRUCTION.md` are **100% complete**:
- **Phase 0:** Safety Net, Hygiene, and Characterization Tests
- **Phase 1:** Correctness and SQLite Primary Storage
- **Phase 2:** Constraint-Aware Scorer v2 (Quote Verifier, Deterministic Gates, Sub-scores, Calibration)
- **Phase 3:** Application Tracker, Follow-up Cadences, and Today Cockpit
- **Phase 4:** Zero-Fabrication Application Kit (Validator, Tailoring Engine, DOCX Export, Kit Studio)
- **Phase 5:** Recall, Sources Watchlist (35 sources), Employer Diversity Cap (<=20%), and Skill Gap Analytics
