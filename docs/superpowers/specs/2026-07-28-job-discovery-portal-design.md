# Job Discovery Portal - Version 1 Design

**Status:** Approved design  
**Date:** 2026-07-28  
**Purpose:** Define the first, production-quality foundation of a personal job-search portal: discover, filter, rank, and alert on suitable openings. This version does not submit applications.

## 1. Vision and success definition

The portal will give its owner a trustworthy view of fresh, suitable senior engineering roles without depending on unreliable page scraping or manually searching every job board. It will combine direct employer vacancy data with job-board alert emails, explain why a role is a match, and send one concise Telegram report after each retrieval cycle.

Version 1 is successful when it can:

- Run automatically twice per day and on an authenticated manual request.
- Check an approved employer watchlist politely and reliably.
- Ingest job alerts from the dedicated Gmail mailbox for LinkedIn, Wellfound, and other supported job boards.
- Identify suitable senior roles, retain evidence for every decision, and avoid duplicate listings.
- Deliver a useful Telegram digest after every retrieval run.
- Show run health and partial failures rather than silently losing openings.

The following are explicitly out of scope for Version 1: submitting applications, form autofill, resume generation, cover letters, WhatsApp alerts, automated expansion of direct ATS polling, and unrestricted browser scraping.

## 2. Candidate profile and match policy

### 2.1 Target profile

The portal is optimized for an engineer with approximately nine years of professional experience, including large-scale backend, distributed systems, SaaS, technical leadership, and AI-workflow automation experience.

Positive technical signals include Java/J2EE, Python, C++, JavaScript/TypeScript, SQL, NoSQL, Unix/Shell, APIs, microservices, distributed systems, Kafka, ETL/ELT, AWS, Docker, CI/CD, observability, React, LLM/agent workflows, vector databases, and system design.

### 2.2 Eligibility rules

| Category | Decision |
| --- | --- |
| Seniority | Prefer Senior Software Engineer, SDE, MTS, Staff, Principal, Backend, Platform, Infrastructure, Distributed Systems, Data/Streaming, and strong full-stack roles. |
| Exclusions | Exclude frontend-only, junior, graduate, and internship roles. |
| Remote | Include roles explicitly eligible worldwide or from India. |
| Relocation | Retain location-restricted roles only when the source explicitly supports relocation or work authorization; prioritize Japan and South Korea. |
| Compensation | Include roles at or above INR 20 lakh annually when disclosed. Retain otherwise strong roles when pay is absent and label them **Salary not stated**. |
| Working hours | Prefer roles compatible with an 8-9 hour workday when this information is disclosed. Do not infer working conditions when a listing is silent. |

### 2.3 Ranking policy

Hard filters remove clear mismatches. Remaining roles receive a score from 0 to 100 based on title/seniority, technical alignment, remote or sponsorship eligibility, compensation information, employer priority, freshness, and semantic alignment with the candidate profile.

Initial thresholds are deliberately conservative and configurable:

- **70-100:** Include in the Telegram digest.
- **55-69:** Place in the dashboard review queue.
- **Below 55:** Retain for audit/history but hide by default.

Every AI-derived interpretation must display a concise reason, confidence, and supporting text. The system must label sponsorship as `explicit`, `possible`, or `unconfirmed`; it must never make an unsupported promise.

## 3. Discovery strategy

The architecture uses a hybrid acquisition model, ordered by source quality:

1. **Approved employer ATS sources.** Use public, documented or verified ATS endpoints before considering rendered pages. Initial adapters cover Greenhouse, Lever, Ashby, and SmartRecruiters; other platforms are added only after a company-specific source is verified. Authoritative for job status and closures.
2. **Job-board alert inbox.** LinkedIn, Wellfound, and popular remote boards feed a dedicated Gmail label through user-configured saved searches and notifications. Non-authoritative for job closures.
3. **RSS feeds (Aggregators & Direct).** Structured RSS/Atom feeds (e.g., We Work Remotely, RemoteOK, or single-employer feeds). Aggregator feeds surface openings across multiple employers without requiring immediate individual ATS setup. Non-authoritative for job closures.
4. **Review queue.** Unparseable messages, ambiguous ATS detections, candidate employer sources, and **possible duplicates** surfaced for candidate approval before AI scoring or alerting.

The direct ATS watchlist starts with all companies from the user-selected We Work Remotely list plus the separately named companies. RSS and job-board results may introduce roles at any employer, but their employer is not added to direct ATS polling until explicitly approved.

### 3.1 RSS Aggregator Deduplication Strategy

Aggregator feeds frequently surface roles from companies already monitored directly via ATS. To prevent duplicate alerts without dropping distinct roles, the system enforces a two-tier deduplication pipeline:

- **Level 1 (Exact Match):** If an ingested RSS item's canonical application URL matches an existing job in `jobs` or `job_sources`, the engine automatically attaches the RSS observation to the existing job as an additional `job_source` record.
- **Level 2 (Possible Duplicate):** If the extracted company name matches a tracked company AND title similarity is high (normalized title + location match or fuzzy title similarity > 85%), the job is created with status `possible_duplicate` and routed immediately to the **Review Queue**, bypassing AI match scoring and Telegram alerts until manually resolved.
- **Level 3 (New Role):** If no URL or company/title collision occurs, the role is ingested normally for eligibility filtering and AI evaluation.

## 4. Recommended system architecture

```text
Approved company ATS feeds ─┐
Gmail job-alert inbox ──────┼─> Normalize and deduplicate ─> Eligibility and AI scoring
Manual source review ───────┘                                      │
                                                                     ├─> Neon Postgres / Drizzle
                                                                     ├─> Next.js dashboard
                                                                     └─> Telegram digest
```

### 4.1 Technology choices

| Concern | Chosen technology | Rationale |
| --- | --- | --- |
| Web application | Next.js and TypeScript | Single codebase for dashboard, protected APIs, admin controls, and manual-run initiation. |
| Database | Neon Postgres and Drizzle ORM | Durable relational history, idempotent upserts, strong querying, and alignment with the existing project direction. |
| Background orchestration | Inngest | Durable, retriable workflow steps and concurrency control for many external sources. |
| Scheduled trigger | Vercel Cron | Two separate once-daily UTC cron entries trigger the retrieval workflow. |
| Employer retrieval | Typed ATS adapters | Structured data is more reliable than DOM scraping. |
| Job-board retrieval | Gmail API and Google Pub/Sub | Saved-search email alerts are policy-respecting and broad in coverage. |
| AI evaluation | Provider interface: Ollama or hosted model | Supports a privacy/cost choice without changing the match rubric. |
| Alerts | Telegram Bot API | Simple, private, automated Version 1 notifications. |

Vercel Hobby cron jobs run at most once per cron expression per day and have hourly timing precision. The portal therefore uses `30 3 * * *` and `30 15 * * *`, corresponding to approximately 9 AM and 9 PM IST. Exact minute-level scheduling would require a different scheduler or paid plan.

## 5. Retrieval and alert workflow

Each scheduled or manual run creates a durable `scan_run` and follows this sequence:

1. Authenticate the trigger and acquire a database-backed run lock.
2. Load active, approved ATS source configurations.
3. Fetch sources using adapter-specific limits, retries, timeouts, and small concurrency caps.
4. Read Gmail messages added to the dedicated `JOB_ALERTS` label since the stored history checkpoint.
5. Parse all source records into a common job schema.
6. Canonicalize URLs and deduplicate records using an ATS external ID where available, otherwise normalized company, title, location, and canonical application URL.
7. Persist newly found roles, job updates, source evidence, and any closures from authoritative sources.
8. Apply deterministic filters and score remaining candidates using the selected AI provider.
9. Mark provider failures as **partially unscored**. No automatic fallback to another provider is permitted.
10. Persist outcomes, release the lock, and send one Telegram report summarizing newly qualifying roles and source health.

Gmail push notifications may record that new messages have arrived, but role matching and Telegram delivery occur only during a scheduled scan or an explicit manual run. This preserves the two-retrieval-per-day automation policy.

## 6. AI and semantic matching

The matching engine is deliberately hybrid:

1. **Deterministic eligibility:** titles, seniority, exclusions, location eligibility, and disclosed compensation.
2. **Semantic retrieval:** compare structured role content with a versioned candidate profile through embeddings.
3. **Structured evaluation:** use the selected model to return a constrained JSON assessment containing score, confidence, strengths, concerns, employment eligibility, salary status, sponsorship status, and exact evidence.

The provider setting is a manual switch between:

- **Local mode:** Ollama-based embeddings and structured evaluation.
- **Hosted mode:** a configurable external embeddings/LLM provider.

The selected provider, model version, prompt version, candidate-profile version, and content hash are stored with every evaluation. Results are cached to avoid repeated cost and inconsistent evaluation. If a selected provider is unavailable, the system stores a partial result and retries during the next scan; data must not be sent to another provider automatically.

## 7. Data model

| Entity | Responsibility |
| --- | --- |
| `companies` | Approved employers, priority, remote/relocation notes, and lifecycle state. |
| `source_configs` | ATS, Gmail, RSS, or future source configuration; `adapter_type` (`greenhouse`, `lever`, `ashby`, `smartrecruiters`, `gmail`, `rss`), rate limit, status, and credentials reference. `company_id` is nullable for aggregator RSS feeds (e.g. We Work Remotely). |
| `jobs` | Canonical current representation of a role. Status includes `open`, `closed`, and `possible_duplicate`. |
| `job_sources` | Evidence for every source that reported a job. Tracks `source_config_id`, `external_id` (RSS `<guid>` or `<link>`), `raw_payload` JSON snapshot, and `extracted_company_name`. |
| `job_snapshots` | History of observed title, location, description, compensation, and status changes. |
| `scan_runs` | Scheduled/manual run metadata, timestamps, status, lock identity, and totals. |
| `source_run_results` | Per-source outcomes, retry/error data, and freshness. |
| `candidate_profiles` and `profile_versions` | Structured, versioned matching profile created from the resume and user preferences. |
| `job_evaluations` | Rule results, semantic/LLM score, evidence, model settings, and partial-failure status. |
| `alert_deliveries` | Telegram delivery history and idempotency key. |
| `gmail_sync_state` | Gmail history cursor, watched label, and watch expiry. |
| `settings` | AI provider, thresholds, Telegram destination, and operational preferences. |

No job is hard-deleted. Openings become closed ONLY when an authoritative direct ATS source no longer reports them. Job-board email observations and RSS feed items are non-authoritative for closure; when a job drops off an RSS feed, it remains `open` until closed by direct ATS polling or after 30 days of inactivity (`expired_unconfirmed`).

## 8. Dashboard and notifications

### 8.1 Dashboard capabilities

- **Fresh matches (Last 24 Hours / 2 Scans):** Primary default view displaying qualifying roles (`score >= 70`) first discovered (`first_seen_at`) within the last 24 hours (last 2 scan runs), preventing repetition of previously reviewed roles.
- **All active matches:** Comprehensive search and filter view across all historical open roles by score, source, company, location, salary status, sponsorship, and age.
- **Review queue:** medium-confidence roles, unparseable alerts, partially unscored jobs, and **possible duplicates**.
- **Review queue resolution actions:**
  1. **Merge with Existing ATS Job:** Attaches the RSS source evidence to an existing ATS job record.
  2. **Confirm as Distinct Job:** Detaches from candidate duplicate, triggers AI scoring, and dispatches to Telegram digest if high-fit.
  3. **Add Employer to Watchlist:** One-click shortcut to promote an RSS-discovered company to direct ATS polling configuration.
- **Employer watchlist:** approve, pause, configure, or remove direct ATS sources.
- **Sources and health:** last successful retrieval, source status, error messages, and source type (`ats`, `gmail`, `rss`).
- **Runs:** scan history, per-source totals, partial failures, and manual-run access.
- **Settings:** AI provider switch, scoring threshold, profile version, and Telegram configuration.

Each job card shows the application link, source, first seen time, last update, match explanation, score, eligibility flags, salary status, and source evidence.

### 8.2 Telegram digest

After every twice-daily scheduled scan or manual run, Telegram receives one report containing:

- Scan time, source health summary, and total new qualifying roles count.
- **Freshness Rule:** Cards are sent strictly for roles first discovered (`first_seen_at`) during the current scan run that meet the match threshold (`score >= 70`). Previously alerted roles from prior scans (> 24h or previous runs) are never repeated.
- **Zero-New-Roles Notification:** If 0 new qualifying roles are found during a scan, Telegram receives a compact health report (e.g. `Scan Complete: 0 new qualifying roles. All 14 sources healthy.`) to provide continuous system status visibility.
- A concise card for each new role: title, company, location, score, key match reason, salary/sponsorship status, age, and dashboard/application links.
- A clear partial-failure note when a source or AI provider could not complete.

The notification system uses a delivery idempotency key so retried workflow steps never resend the same role alert.

## 9. Security, privacy, and operational safeguards

- Restrict manual runs and dashboard administration to an authenticated user.
- Store database, Telegram, Gmail OAuth, AI-provider, cron, and workflow secrets only in server-side secret storage; never in source control or application logs.
- Grant Gmail read-only access restricted to the dedicated job-alert label.
- Encrypt stored OAuth refresh tokens and retain raw emails only as long as required for parsing and audit.
- Use signed cron and workflow requests, database locks, idempotent writes, and retry-aware handlers.
- Respect every source's terms, rate limits, and robots/access policy. Do not use uncontrolled browser crawling.
- Rate-limit per ATS provider and per company; failed sources retry independently and surface operationally.

## 10. Implementation milestones

### Milestone 1 - Foundation

Create the project structure, environment validation, authentication, migrations, settings, encrypted credential handling, and run-lock mechanism.

### Milestone 2 - Job domain and history

Implement canonical job records, source evidence, snapshots, run tracking, idempotent upserts, deduplication, closure rules, and test fixtures.

### Milestone 3 - Approved ATS discovery

Implement Greenhouse, Lever, Ashby, and SmartRecruiters adapters with source health, polite rate limits, retries, watchlist administration, and a controlled source-review workflow.

### Milestone 4 - Gmail board ingestion

Implement Google OAuth, label-scoped Gmail synchronization, Pub/Sub notifications, watch renewal, alert parsers, and the unparseable-message review queue.

### Milestone 5 - Matching engine

Create the versioned candidate profile, deterministic filtering, provider-selectable semantic evaluation, cached scoring, evidence capture, and partial-failure behavior.

### Milestone 6 - Product surface and alerts

Build the dashboard views, filtering, manual scan control, run health views, Telegram digest formatter, and delivery deduplication.

### Milestone 7 - Verification and rollout

Add unit tests for adapters, parsers, scoring, and deduplication; integration tests for workflow locking and diffing; stage on a small watchlist; then gradually activate the complete company list.

## 11. Verification checklist

Before Version 1 is considered ready, verify that:

- Two scheduled triggers and one protected manual trigger create non-overlapping runs.
- A known new ATS role appears exactly once, even if an alert email reports it too.
- A frontend-only or junior role is excluded.
- A high-fit role with undisclosed salary appears with the correct label.
- Explicit worldwide/India eligibility and Japan/Seoul sponsorship evidence are captured correctly.
- An unavailable AI provider produces a visible partial-score state without fallback.
- A failed source does not prevent other sources from completing or a Telegram report from being delivered.
- Retrying a run does not create duplicate jobs, evaluations, or Telegram messages.
- Gmail access is label-scoped and every secret is absent from repository files and logs.

## 12. Reference documentation

- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron reliability and idempotency guidance](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Gmail API push notifications](https://developers.google.com/workspace/gmail/api/guides/push)
- [Inngest durable execution](https://www.inngest.com/docs/learn/how-functions-are-executed)
- [Telegram Bot API](https://core.telegram.org/bots/api)

## 13. Deferred enhancements

After Version 1 is reliable, the next product phases may add WhatsApp through the existing Meta-approved provider, application preparation, human-approved form completion, application tracking, follow-ups, salary research, and deeper employer intelligence. None of these change the Version 1 discovery data model.
