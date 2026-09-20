# Phase 4 — Application Kit (Resume & Cover Letter)

> **Phase:** 4 (Application Kit: Resume & Cover Letter)  
> **Status:** Proposed / In Execution  
> **Target Size:** L (Large)  
> **Author:** Antigravity  
> **Timestamp:** 2026-09-20  

---

## 1. Goal

Implement the verified, zero-fabrication Application Kit specified in Section 9 of `ANTIGRAVITY_MASTER_INSTRUCTION.md`:
1. **Achievement Bank (`data/kit/achievements.json`):** Verified facts, metrics, employers, and skills seeded from candidate profile.
2. **Resume Base Variants (`data/kit/resumes/`):** 3 structured, single-column ATS-safe variants (`backend-distributed`, `ai-agentic`, `architect`).
3. **Screening Answer Bank (`data/kit/answers.json`):** Notice period, expected CTC, relocation, work authorization, portfolio/GitHub links.
4. **Tailoring Engine:**
   - Map extracted JD requirements (`mustHaveTech`, `niceToHaveTech`) → banked achievement IDs.
   - Compute requirement coverage and compile an explicit **Skill Gap List** (never papered over).
   - Select closest resume variant and prioritize/reorder bullets.
5. **Hard Validator:** Strict zero-fabrication guardrail ensuring every number, tool, employer, and metric in the generated resume bullet or cover letter appears verbatim in the referenced achievements or JD text. Rejects any unbanked technology or fabricated metric.
6. **Cover Letter Generator:** 180–230 word targeted cover letter with JD-derived opening, two banked proof points, and honest gap handling.
7. **Export & Send Path:**
   - Clean printable HTML/PDF stylesheet and DOCX generation.
   - Save version and link to `applications.resumeVersionId`.
   - Gmail draft composition (OAuth compose scope or mailto fallback) with attachments; copy-ready ATS cheat sheet. Never auto-submit or auto-send.

---

## 2. Technical Design & Architecture

### 2.1 Storage & File Structure
All kit files are stored in `data/kit/` (gitignored):
* `data/kit/achievements.json`:
  ```json
  [
    {
      "id": "ach_amdocs_crm_latency",
      "employerOrProject": "Amdocs",
      "claim": "Led backend architecture of distributed CRM microservices for telecom subscribers",
      "metric": "40% latency reduction in query response times across millions of subscribers",
      "period": "2020 - Present",
      "evidence": "Production Amdocs CRM SaaS deployment",
      "skills": ["Java", "Spring Boot", "Kafka", "Microservices Architecture", "Distributed Systems", "SQL", "PostgreSQL", "REST APIs", "Observability & Telemetry"]
    },
    ...
  ]
  ```
* `data/kit/resumes/{backend-distributed,ai-agentic,architect}.json`: ATS-safe single-column structured templates.
* `data/kit/answers.json`: Screening answer bank with candidate parameters.

### 2.2 Tailoring Engine (`lib/kit/tailor.ts`)
* `tailorApplicationKit(jobId, options)`:
  1. Loads job details and extracted facts (`mustHaveTech`, `niceToHaveTech`, domain tags).
  2. Maps tech requirements against banked skills; identifies covered skills and unbanked **Gaps**.
  3. Chooses closest resume variant (`backend-distributed` vs `ai-agentic` vs `architect`).
  4. Ranks bullets based on requirement overlap.
  5. Generates targeted cover letter draft (180–230 words) citing exact banked metrics.
  6. Validates output through `HardValidator`.

### 2.3 Hard Validator (`lib/kit/validator.ts`)
* Validates every claim against `achievements.json` and JD facts.
* Ensures zero unbanked numbers/tools/employers. If an unbanked entity is detected, rejects and falls back to the deterministic unphrased banked variant.
* Unit-tested with adversarial test cases (hallucinated tools, inflated numbers).

### 2.4 Document Export & Gmail Draft (`lib/kit/export.ts`)
* DOCX export generation using `docx` package.
* Clean HTML print stylesheet for one-click browser "Save as PDF".
* Gmail draft generator: creates copy-ready mail or mailto link with attached resume version ID.

### 2.5 UI Kit Studio (`components/kit/KitStudio.tsx` & `app/page.tsx`)
* Application Kit tab / drawer modal:
  - Resume variant preview with highlighted skill matches and transparent Gap List.
  - Generated Cover Letter with word count and proof point audit.
  - One-click "Approve & Link to Application".
  - Download DOCX / Print PDF.
  - ATS screening answers cheat sheet (copy button for each answer).

---

## 3. Task List

1. [x] **Data Snapshot:** Backup `data/`.
2. [ ] **Seed Kit Data:** Create `data/kit/achievements.json`, `data/kit/resumes/*.json`, and `data/kit/answers.json`.
3. [ ] **Hard Validator:** Implement `lib/kit/validator.ts` and adversarial test suite in `tests/phase4/validator.test.ts`.
4. [ ] **Tailoring Engine:** Implement `lib/kit/tailor.ts` (coverage mapping, gap detection, resume bullet selection, cover letter generation).
5. [ ] **Export Engine:** Implement DOCX and HTML/PDF export in `lib/kit/export.ts`.
6. [ ] **API Endpoints:** Implement `/api/kit/tailor`, `/api/kit/export`, `/api/kit/answers`.
7. [ ] **UI Integration:** Implement `KitStudio.tsx` and integrate into the main dashboard and drawer.
8. [ ] **Verification:** Run Vitest test suite, Next.js build, and ESLint checks.

---

## 4. Test Plan

* **Adversarial Validator Tests (`tests/phase4/validator.test.ts`):**
  * Reject bullets containing unbanked tools (e.g. "Kubernetes 1.25" when not in achievement).
  * Reject bullets containing inflated or hallucinated metrics (e.g. "99% latency reduction" vs 40%).
  * Allow exact banked tools and numbers.
  * Verify gap detection lists missing requirements explicitly without hiding.
  * Cover letter word count constraint (180–230 words).
* **Export Tests (`tests/phase4/export.test.ts`):**
  * Generate valid DOCX buffer without errors.
  * Link generated version ID to `applications.resumeVersionId`.
