# Phase 4 Report — Application Kit (Resume & Cover Letter)

## 1. What Changed

### Files Created & Modified
* **Banked Foundations & Seeds:**
  * `data/kit/achievements.json`: 4 verified candidate achievements seeded strictly from `profile.json` (`ach_amdocs_crm_latency`, `ach_smriti_conversational_ai`, `ach_enterprise_oauth2_solution`, `ach_high_throughput_kafka`), with immutable claims, metrics, evidence, and skill mappings.
  * `data/kit/answers.json`: Screening answer bank covering notice period, current & expected CTC, relocation preferences, work authorization, and portfolio/GitHub links.
  * `data/kit/resumes/{backend-distributed,ai-agentic,architect}.json`: Three single-column ATS-safe resume variants, each strictly referencing verified achievement IDs.
* **Kit Types & Hard Validator:**
  * `lib/kit/types.ts`: TypeScript contracts for achievements, structured resumes, tailored kits, validation results, and screening answers.
  * `lib/kit/validator.ts`: Zero-fabrication hard validator:
    * `validateSkillCoverage`: Transparently computes covered vs. missing skills and coverage ratio against target JD requirements.
    * `validateResumeBullet`: Adversarially checks bullet text against referenced achievement. Rejects bullets containing unbanked numbers, unbanked tools/technologies, or unbanked employer names.
    * `validateCoverLetter`: Enforces 180–230 word count, validates that referenced achievement IDs exist, checks for banned subjective superlatives (`guru`, `rockstar`, `ninja`, `perfectionist`), and verifies the inclusion of an honest gap sentence.
* **Tailoring Engine:**
  * `lib/kit/tailor.ts`: Deterministic variant selector (`ai-agentic` for AI/ML roles, `architect` for architect/principal roles, `backend-distributed` for backend/distributed roles), skill gap calculator, bullet relevance scorer and reorderer, and cover letter synthesizer. Enforces fallback to raw banked bullet claims if candidate-adapted text fails validation.
* **Export Engine:**
  * `lib/kit/export.ts`:
    * `generateResumeDocx`: Generates clean single-column `.docx` files using the `docx` library (ATS-friendly headings, tables for dates/locations, standard bullet points).
    * `generatePrintableHtml`: Clean, single-column print stylesheet formatted for A4/Letter PDF printing without multi-column parsing traps.
    * `generateGmailDraftUrl`: Synthesizes one-click `mailto:` / Gmail compose web URLs with tailored cover letter and subject line.
* **API Endpoints:**
  * `app/api/kit/tailor/route.ts`: POST endpoint to generate or retrieve tailored application kit for a target job.
  * `app/api/kit/export/route.ts`: POST endpoint to export tailored resume as `.docx` or printable HTML.
  * `app/api/kit/answers/route.ts`: GET endpoint to retrieve screening answer bank.
* **UI & Studio:**
  * `components/kit/KitStudio.tsx`: Interactive Kit Studio featuring:
    * Skill coverage gauge, matched skills badges, and transparent red-flagged Missing Gap list.
    * Live resume preview with reordered bullets and zero-fabrication badge.
    * One-click "Download ATS Resume (.docx)" and "Print / Save as PDF" buttons.
    * Cover letter preview with copy-to-clipboard and "Draft in Gmail ↗" action.
    * ATS screening answers cheat sheet with instant copy buttons for forms.
  * `app/page.tsx`: Embedded "Tailor Application Kit (Resume & Cover Letter) ↗" button in the job detail drawer, along with modal overlay for `KitStudio`.
* **Testing:**
  * `tests/phase4/validator.test.ts`: 6 adversarial unit tests verifying metric verification, tool extraction, skill coverage gap calculation, word count bounds, unbanked claim rejection, and superlative blocking.
  * `tests/phase4/tailor.test.ts`: 2 integration tests verifying automated variant selection, bullet ranking, gap detection, DOCX generation, and HTML rendering.

### Dependencies Added
* `docx` (pure JavaScript library, ~1.5 MB, zero native C++ binaries, used for generating standards-compliant OpenXML `.docx` resumes for ATS ingestion).

---

## 2. Evidence & Audit Results

### Test Suite Execution (`vitest`)
Ran `pnpm test`: **17 test files passed, 83 total tests passed, 0 failures**.
```
 ✓ tests/phase4/tailor.test.ts (2 tests)
 ✓ tests/phase3/applications.test.ts (6 tests)
 ✓ tests/phase1/db.test.ts (2 tests)
 ✓ tests/phase1/api.test.ts (3 tests)
 ✓ tests/characterization/telegram.test.ts (4 tests)
 ✓ tests/phase1/lifecycle.test.ts (5 tests)
 ✓ tests/phase1/second_scan_stripe.test.ts (1 test)
 ✓ tests/phase2/scorer-v2.test.ts (3 tests)
 ✓ tests/phase2/gates.test.ts (15 tests)
 ✓ tests/phase4/validator.test.ts (6 tests)
 ✓ tests/phase1/migration.test.ts (5 tests)
 ✓ tests/characterization/dedup.test.ts (9 tests)
 ✓ tests/phase2/quote-verifier.test.ts (4 tests)
 ✓ tests/phase2/sub-scores.test.ts (7 tests)
 ✓ tests/phase1/regression.test.ts (5 tests)
 ✓ tests/characterization/gate.test.ts (3 tests)
 ✓ tests/characterization/heuristics.test.ts (3 tests)

 Test Files  17 passed (17)
      Tests  83 passed (83)
```

### Build & Lint Verification
* `pnpm build`: Completed successfully with 0 errors across all 20 routes (App Router dynamic and static).
* `pnpm lint`: Completed successfully with 0 warnings or errors.

---

## 3. Behavior Changes the User Will Notice

1. **Kit Studio Modal in Job Drawer:** Opening any job card in the drawer now features a prominent purple action button: "Tailor Application Kit (Resume & Cover Letter) ↗".
2. **Transparent Skill Gap Breakdown:** Kit Studio highlights both matched skills and explicit missing skill gaps right at the top so you know exactly where the profile differs from the JD.
3. **One-Click ATS Resume Export:** Instantly download a `.docx` file formatted cleanly for ATS parsers or open printable HTML for PDF generation.
4. **Bank-Verified Cover Letters:** Tailored cover letters cite verbatim achievement metrics and candidly acknowledge skills gaps rather than fabricating experience.
5. **Direct Gmail Compose Links:** Clicking "Draft in Gmail" opens a prefilled email compose window with the company name, job title, and cover letter body.
6. **Screening Cheat Sheet:** Instant copy buttons for standard ATS questionnaire answers (notice period, CTC, work authorization, portfolio links).

---

## 4. Known Gaps / Risks

1. **Static Achievement Seeding:** Initial achievement pool has 4 core achievements from `profile.json`. As new projects and milestones occur, additional entries can be appended to `data/kit/achievements.json`.
2. **Local DOCX Generation:** Word document styles use clean standard fonts (Calibri, Arial) to maximize ATS parser compatibility.

---

## 5. Manual Steps for the User

1. **Open a High-Tier Job:** Select any Tier A or Tier B job in the dashboard and open its detail drawer.
2. **Click "Tailor Application Kit":** Inspect the selected resume variant, the transparent gap list, and the generated cover letter.
3. **Export & Apply:** Download the tailored `.docx` or draft the email in Gmail with one click.

---

## 6. Open Questions & Decision Items

* None. Zero-fabrication directive strictly upheld.

---

## 7. Proposed Next-Phase Scope: Phase 5 — Recall, Sources, and Insights

Phase 5 will implement Section 10 of `ANTIGRAVITY_MASTER_INSTRUCTION.md`:
1. **Source Discovery (`pnpm add-company <careers-url>`):** CLI and UI command that inspects a company careers URL, auto-detects ATS type (`greenhouse`, `lever`, `workable`, `recruitee`, `ashby`, `smartrecruiters`), extracts the board token, and adds it to the watchlist.
2. **Employer Diversity Cap:** Enforce a maximum 20% cap per employer in the top distinct view to prevent Datadog/Stripe skew.
3. **New ATS Adapters:** Implement adapter extensions for Workable, Recruitee, BambooHR, and Hacker News Who is Hiring (Algolia API).
4. **Japan/Korea Sources (D8):** Ingest bilingual/English tech sources in Tokyo/Seoul (e.g., TokyoDev, Japan Dev, Wantedly) when D8 is enabled.
5. **Skill-Gap Aggregator Panel:** High-level dashboard showing the most frequent missing skills across Tier A and Tier B jobs to guide candidate learning priorities.
