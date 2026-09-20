# Phase 1 — Correctness and Storage

> **Phase:** 1 (Correctness & Storage)  
> **Status:** Proposed / In Progress  
> **Target Size:** L (Large)  
> **Author:** Antigravity  
> **Timestamp:** 2026-09-20  

---

## 1. Goal

Eliminate data corruption, identity collisions, schema drift, and scheduling fragility by introducing a robust SQLite + Drizzle storage layer, deterministic word-boundary gating, accurate job lifecycle tracking, seniority-preserving deduplication, and production ops tooling.

Key objectives:
1. **Stable Identity (F1):** Primary key `(ats, slug, externalId)`; retain `gh_jid` in Greenhouse canonical URLs so company-hosted boards (e.g. Stripe) do not collapse.
2. **Deterministic Gate v2 (F2):** Word-boundary regex matching for title exclusions so legitimate engineering roles ("Internal Tools", "International") pass; stub role-family classifier.
3. **SQLite Storage & Migration (D10, F4, F12):** Implement SQLite database via Drizzle ORM (`better-sqlite3`). Migrate `data/jobs.json` (all 1,975 records) idempotently, backfilling `status`, `firstSeenAt`, and `lastSeenAt` for the 1,386 legacy rows with zero null statuses.
4. **JD Persistence (F4):** Persist cleaned description text (entities decoded) and SHA-256 content hashes for every job in a dedicated `job_descriptions` table.
5. **Robust Lifecycle (F5, F6):** Update `lastSeenAt` in the DB on every sighting; close a job only after **2 consecutive scans** without it; implement source health safeguards (empty or >50% drop does not close jobs); emit `reopened` events.
6. **Freshness Tracking (F15):** Capture native ATS publication dates (`updated_at`, `createdAt`, `publishedAt`); compute accurate "posted N days ago".
7. **Dedup v2 (F11):** Seniority-aware similarity matching restricted within same company and location set; auto-resolve clean jobs so Review Queue stays focused.
8. **RSS Normalization (F10):** Read region/country fields if present in RSS feeds; otherwise set location to `unknown`, never `'Remote / Global'`.
9. **Ops & Automation (F16, F18):** File lock to prevent concurrent scan collisions; Windows Task Scheduler setup script (`scripts/install-schedule.cmd`); accurate `sourcesChecked` metrics; dashboard banner indicating last scan timestamp.

---

## 2. Technical Design & Architecture

### 2.1 Dependencies Justification
- `better-sqlite3` and `@types/better-sqlite3`:
  - *Why:* High-performance, synchronous, embedded C++ SQLite3 driver for Node.js. Ideal for local single-user CLI and Next.js server environment on Windows 11. Zero network latency, full ACID compliance, simple local backup.
  - *Alternative considered:* `@libsql/client` (overkill for local-only file storage), PostgreSQL/Neon (requires external network, conflicting with local-first directive).
- `drizzle-orm` is already present in `package.json`.

### 2.2 Database Schema (`lib/db/schema.ts`)
Tables:
1. **`sources`**: Tracked ATS boards and feeds (`id`, `ats`, `slug`, `name`, `feedUrl`, `active`, `lastSuccessAt`, `lastErrorAt`, `lastHttpStatus`, `lastJobCount`, `createdAt`).
2. **`jobs`**: Core job postings (`id` PK, `ats`, `slug`, `externalId`, `title`, `company`, `location`, `locationClass`, `canonicalUrl`, `applyUrl`, `sourceType`, `score`, `matchReason`, `sponsorship`, `isRemote`, `salary`, `status`, `consecutiveMissingScans`, `firstSeenAt`, `lastSeenAt`, `firstPublishedAt`, `gateReason`, `rawJson`).
3. **`job_descriptions`**: Persisted JD text (`jobId` PK FK, `contentHash`, `descriptionText`, `descriptionHtml`, `updatedAt`).
4. **`job_events`**: Append-only audit log (`id` PK, `jobId` FK, `eventType`, `createdAt`, `payloadJson`).
5. **`runs`**: Historical scan executions (`id` PK, `startedAt`, `finishedAt`, `sourcesChecked`, `healthySourcesCount`, `jobsSeenCount`, `newJobsCount`, `closedJobsCount`, `status`, `error`).
6. **Reserved tables (Phase 3 & 4):** `applications`, `application_events`, `kit_achievements`, `kit_resumes`.

### 2.3 Identity & Canonicalization Fix (F1)
- `canonicalizeUrl`:
  - Preserve `gh_jid` (Greenhouse job ID).
  - Strip only analytics/tracking params: `utm_*`, `gh_src`, `lever-origin`, `ref`, `source`, `fbclid`, `gclid`.
  - Maintain stable identity key: `${ats}:${slug}:${externalId}`.

### 2.4 Deterministic Gate v2 (F2)
- Match exclusion keywords with word boundary regex `/\b<kw>\b/i` instead of naive `.includes()`.
- Whitelist "Internal", "International", "Interpreter".
- Add role-family classifier stub: categorizes into `backend_distributed`, `ai_agentic`, `architecture`, `fullstack_backend`, or `unsupported`.

### 2.5 Deduplication v2 (F11)
- Level 1: Match on primary key `(ats, slug, externalId)` or canonical URL.
- Level 2: Fuzzy comparison is ONLY performed when:
  1. Normalized company names match.
  2. Normalized locations match (e.g. Bangalore vs Remote-US is never a duplicate).
  3. Title similarity retains seniority tokens (Senior vs Staff is not duplicate).
- Auto-resolve clear distinctions so Review Queue stays empty.

### 2.6 Lifecycle & Staleness Guard (F5, F6)
- Maintain `consecutiveMissingScans` count on each job.
- If source fetch succeeds and job is missing:
  - If `consecutiveMissingScans == 0`: set to 1 (grace period).
  - If `consecutiveMissingScans >= 1`: set `status = 'closed'`, emit `closed` event.
- If source returns 0 jobs or >50% drop compared to `lastJobCount`, flag source as degraded, skip missing scan increment.
- When a closed job reappears: set `status = 'open'`, `consecutiveMissingScans = 0`, emit `reopened` event.

### 2.7 Ingestion & Ops Tooling (F15, F16, F18)
- Extract native publication dates: `updated_at` / `first_published` (Greenhouse), `createdAt` (Lever), `publishedAt` (Ashby).
- RSS: parse `<dc:creator>`, `<category>`, `<location>` custom fields; fallback to `'unknown'`.
- Scanner lockfile: `data/scanner.lock` prevents overlapping scan processes.
- Windows Task Scheduler script: `scripts/install-schedule.cmd`.

---

## 3. Task List

- [ ] **Task 1.1:** Write reproduction tests in `tests/phase1/` demonstrating current bugs (F1 Stripe collapse, F2 Internal Tools drop, F11 Bangalore vs US false duplicate).
- [ ] **Task 1.2:** Install `better-sqlite3` and `@types/better-sqlite3`.
- [ ] **Task 1.3:** Define Drizzle SQLite schema and DB client in `lib/db/`.
- [ ] **Task 1.4:** Implement URL canonicalization fix (preserve `gh_jid`) and identity generator.
- [ ] **Task 1.5:** Implement Deterministic Gate v2 with word boundaries and role-family classifier.
- [ ] **Task 1.6:** Implement Dedup v2 with seniority tokens and location matching.
- [ ] **Task 1.7:** Implement migration script (`scripts/migrate-json-to-sqlite.ts`) with legacy data backfill for 1,386 unversioned records. Run migration and verify count ≥ 1,975.
- [ ] **Task 1.8:** Implement JD persistence module (Cheerio text cleaner, sha256 hash, DB store).
- [ ] **Task 1.9:** Implement 2-scan lifecycle logic with source-failure protection and reopen events.
- [ ] **Task 1.10:** Update RSS adapter to handle regional fields and stop fabricating `'Remote / Global'`.
- [ ] **Task 1.11:** Update Next.js API routes (`/api/jobs`, `/api/companies`, `/api/scans`) to query SQLite via Drizzle.
- [ ] **Task 1.12:** Add scanner lockfile guard and Task Scheduler batch installer (`scripts/install-schedule.cmd`).
- [ ] **Task 1.13:** Run all unit, characterization, and Phase 1 regression tests; verify green.
- [ ] **Task 1.14:** Test simulated second scan and verify dashboard displays migrated open jobs.
- [ ] **Task 1.15:** Commit Phase 1 changes and produce Phase 1 Report.

---

## 4. Test Plan

1. **Reproduction Tests (TDD):**
   - Stripe URL canonicalization: `https://stripe.com/jobs/search?gh_jid=123` vs `...456` must produce distinct canonical URLs.
   - Deterministic Gate: "Software Engineer, Internal Tools" must return `true`; "Software Engineer Intern" must return `false`.
   - Dedup: "Senior SWE (AI/ML), Trust [Bangalore]" vs "Senior Staff SWE, Trust [Remote-US]" must NOT be flagged duplicate.
2. **Migration Audit:**
   - Total rows in `jobs` table ≥ 1,975.
   - Count of jobs with `status IS NULL` must be 0.
   - Count of jobs with `firstSeenAt IS NULL` or `lastSeenAt IS NULL` must be 0.
3. **Lifecycle Verification:**
   - Scan 1: sighting recorded, `status = 'open'`.
   - Missing Scan 1: `consecutiveMissingScans = 1`, `status = 'open'`.
   - Missing Scan 2: `consecutiveMissingScans = 2`, `status = 'closed'`.
   - Reappearance: `status = 'open'`, `reopened` event emitted.
4. **UI & API Integration:**
   - `/api/jobs?distinct=true` returns open migrated jobs from SQLite.
   - Dashboard renders migrated catalog correctly.

---

## 5. Rollback Strategy

1. Code changes can be reverted cleanly via git.
2. Data safety: Original `data/jobs.json` is preserved and backed up in `data-backup/2026-09-20T16-30-00/`.
3. If SQLite database needs to be rebuilt, `scripts/migrate-json-to-sqlite.ts` is completely idempotent and can be rerun at any time.
