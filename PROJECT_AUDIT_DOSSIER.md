# JobAppy Assist — Comprehensive Architecture & Audit Dossier

> **Classification:** Project Audit & Technical Architecture Dossier  
> **Target Audience:** Incoming AI Auditor / Principal Systems Reviewer  
> **Timestamp:** 2026-09-20  
> **Status:** Production Reference  

---

## 1. Executive Summary & Core Mission

**JobAppy Assist** (`job-appy-assist`) is an automated career intelligence platform and high-precision job discovery portal engineered for a senior distributed systems and AI engineer.

Instead of scraping fragile, anti-bot-protected job aggregator websites, the platform:
1. **Directly connects to authoritative public employer ATS APIs** ([Greenhouse](https://boards-api.greenhouse.io), [Lever](https://api.lever.co), [Ashby](https://api.ashbyhq.com), [SmartRecruiters](https://api.smartrecruiters.com)) and curated RSS feeds.
2. **Accepts arbitrary on-demand job URLs** via a universal Cheerio-based metadata and HTML extraction engine.
3. **Applies a 3-stage deterministic & AI evaluation pipeline** calibrated specifically against the candidate's verified background to output a 0–100 relevance score, executive rationale, evidence quotes, visa sponsorship status, and risk flags.
4. **Enforces a two-tier deduplication engine** (canonical URL tracking and Jaccard title/company fuzzy matching).
5. **Renders opportunities in an ultra-modern glassmorphic command center** ([`app/page.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/page.tsx)) featuring a "Top Distinct Company Openings" engine and dispatches automated **Telegram digests**.

---

## 2. Calibrated Candidate Persona

All evaluation heuristics, LLM prompts, and gating rules are bound to the profile declared in [`data/profile.json`](file:///C:/Luminary/Projects/job-appy-assist/data/profile.json):

* **Candidate:** Manish Kumar Prajapati
* **Experience Level:** ~8.5+ Years
* **Current Position:** Software Engineer (Advanced) at Amdocs
* **Education:** Master in Computer Application (MCA), BIT Mesra (CGPA 8.02, AIR 7)
* **Core Technical Competencies:**
  * **Languages:** Java, Python, TypeScript, JavaScript, SQL, C++, Shell script
  * **Backend & Distributed Systems:** Microservices Architecture, Distributed Systems, Apache Kafka, High-Throughput Pipelines, ETL/ELT, REST APIs, System Design, Zero-Downtime Migrations, Observability & Telemetry
  * **AI & Agentic Automation:** AI Agents & Agentic Loops, LLM Orchestration, Zero-Fabrication Retrieval Architecture, Vector Databases (Pinecone), In-Process Cosine Similarity, Failover Cascades & Resilience, n8n Automation
  * **Databases & Storage:** PostgreSQL, MongoDB, Oracle, Pinecone Vector DB, Redis
  * **Cloud & DevOps:** AWS (S3, RDS, Cloud-Native), Docker, CI/CD (Jenkins), Linux/Unix
* **Key Proof Points:**
  * *Amdocs CRM SaaS Platform:* Core backend distributed SaaS powering CRM for millions of telecom subscribers; reduced customer service query handling times by 40%.
  * *Smriti Conversational Architecture:* Flagship production AI system with zero-fabrication retrieval constraints, deterministic emotional gating, in-process cosine similarity over 768-dim embeddings, and failover cascades across model versions.
  * *Enterprise OAuth2 Migration Solution:* Enterprise solution and technical publication resolving OAuth2 authentication failures across IMAP/POP3 protocol migrations.
* **Target Roles:** Staff Software Engineer, Principal Engineer, Lead Engineer, Senior Backend Engineer, Distributed Systems Architect, AI Platform Architect.
* **Target Locations & Compensation:**
  * Worldwide Remote or Remote within India.
  * International relocation restricted to **Japan (Tokyo)** and **South Korea (Seoul)** with explicit visa sponsorship.
  * Target compensation: **INR 35–65 LPA** (hard floor: INR 25L).
* **Hard Dealbreakers:** Junior/intern roles, frontend-only/pure UI roles, agency/contract sweatshops, and mandatory non-sponsored international on-site requirements.

---

## 3. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Sources ["1. Ingestion Sources"]
        ATS["Direct ATS Adapters\n(Greenhouse, Lever, Ashby, SmartRecruiters)"]
        RSS["Curated RSS Feeds\n(We Work Remotely, etc.)"]
        URL["Universal URL Evaluator\n(Any Web Page / Cheerio)"]
        WH["Broadcast Webhooks\n(Telegram / Discord / Inbound)"]
    end

    subgraph Pipeline ["2. Processing & Evaluation Engine"]
        Gate["Stage 1: Deterministic Exclusion Gate\n(Excludes junior, intern, frontend-only)"]
        Dedup["Stage 2: Two-Tier Deduplication\n(Level 1: Exact URL Canonicalizer\nLevel 2: Jaccard Fuzzy Title/Company Match)"]
        AI["Stage 3: Hybrid Fit Evaluator\n(Gemini 2.5 Flash API / Ollama Qwen2.5 / Heuristic Rule Engine)"]
    end

    subgraph Persistence ["3. Dual Persistence Layer"]
        JSONStore[("Atomic JSON Datastore\ndata/jobs.json\ndata/companies.json\ndata/profile.json\ndata/scans/*.json")]
        NeonDB[("Neon Postgres DB + Drizzle ORM\n(Schema ready for cloud sync)")]
    end

    subgraph Presentation ["4. Surfaces & Delivery"]
        UI["Glassmorphic Next.js 14 Dashboard\n(Distinct Company Engine, Review Queue, Drawer)"]
        TG["Telegram Notification Bot\n(Automated Fresh Role Markdown Digest)"]
    end

    ATS --> Gate
    RSS --> Gate
    URL --> Gate
    WH --> Gate

    Gate --> Dedup
    Dedup -- Clean / Unique --> AI
    Dedup -- Possible Duplicate --> JSONStore
    AI --> JSONStore
    AI -.-> NeonDB
    
    JSONStore --> UI
    JSONStore --> TG
```

---

## 4. Ingestion Pipeline & Adapters

### 4.1 Direct ATS Adapters ([`lib/ats-adapters.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/ats-adapters.ts))
Executes deterministic, HTTP-polite queries against public JSON feeds exposed by employer applicant tracking systems:
* **Greenhouse:** `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`
* **Lever:** `https://api.lever.co/v0/postings/{slug}?mode=json`
* **Ashby:** `https://api.ashbyhq.com/posting-api/job-board/{slug}`
* **SmartRecruiters:** `https://api.smartrecruiters.com/v1/companies/{slug}/postings`
* **Custom Headers:** Requests specify `User-Agent: JobAppy-Portal/2.0 (Candidate-Discovery)` with `cache: 'no-store'`.

### 4.2 RSS Feed Ingestion ([`lib/ats-adapters.ts#L69-L102`](file:///C:/Luminary/Projects/job-appy-assist/lib/ats-adapters.ts#L69-L102))
* Parses RSS/Atom XML feeds (e.g., We Work Remotely Backend and Full-Stack channels).
* Extracts job titles, creators, descriptions, and publication dates, and maps them into the uniform `RawJobPosting` contract.

### 4.3 Universal URL Evaluator ([`lib/url-evaluator.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/url-evaluator.ts))
Enables ad-hoc manual evaluation of any job posting URL pasted by the user:
* **ATS URL Detection:** Detects if the URL belongs to Greenhouse or Lever and redirects to their direct JSON API endpoints.
* **Cheerio Universal Scraper:** Strips non-content DOM nodes (`<script>`, `<style>`, `<nav>`, `<footer>`, `<form>`), locates description selectors (`[data-qa="job-description"]`, `article`, `main`, `.content`), extracts OpenGraph / Twitter metadata (`og:title`, `og:site_name`, `meta[name="job_location"]`), and synthesizes a clean `RawJobPosting`.

### 4.4 Webhook Broadcast Receiver ([`app/api/webhooks/broadcast/route.ts`](file:///C:/Luminary/Projects/job-appy-assist/app/api/webhooks/broadcast/route.ts))
* Ingests single-opening payloads from external integrations (e.g., Telegram channels, Discord bots, Chrome extensions) and pushes them immediately through the evaluation pipeline.

---

## 5. Filtering, Deduplication & Scoring Engine

### 5.1 Stage 1: Deterministic Gate ([`lib/ai-evaluator.ts#L20-L37`](file:///C:/Luminary/Projects/job-appy-assist/lib/ai-evaluator.ts#L20-L37))
* Sub-millisecond string inspection on titles.
* Drops negative keywords immediately: `junior`, `intern`, `internship`, `graduate`, `entry level`, `freshman`, `associate software engineer`, `trainee`, `frontend only`, `wordpress developer`, `ui designer`.

### 5.2 Stage 2: Two-Tier Deduplication ([`lib/dedup.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/dedup.ts))
* **URL Canonicalization:** Strips query tracking parameters (`utm_source`, `utm_medium`, `gh_jid`, `lever-origin`, `ref`, `gh_src`), normalizes protocol/case, and strips trailing slashes.
* **Level 1 (Exact Match):** If canonical URLs match an existing posting in [`data/jobs.json`](file:///C:/Luminary/Projects/job-appy-assist/data/jobs.json):
  * Updates `lastSeenAt`.
  * Appends multi-source corroboration evidence (e.g., `"Greenhouse + We Work Remotely"`).
  * Increments `sourcesCount` without creating duplicate records.
* **Level 2 (Fuzzy Match):** Normalizes company names (stripping `inc`, `corp`, `llc`, etc.) and titles (stripping seniority prefixes). Uses **Jaccard Word Similarity**:
  $$\text{Similarity}(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
  * If $\text{Similarity} \ge 0.60$ for matching companies: flags as `status: 'possible_duplicate'`, references parent `matchedJobId`, and diverts to the **Dashboard Review Queue** without polluting primary feeds.
* **Level 3 (Unique):** Emits status `open`.

### 5.3 Stage 3: Hybrid Fit Evaluation ([`lib/ai-evaluator.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/ai-evaluator.ts))
Supports a 3-tier cascade:
1. **Primary: Gemini 2.5 Flash API:** If `GEMINI_API_KEY` is present, sends candidate profile and description excerpt (up to 2,500 chars) with structured JSON schema output request (`score`, `matchReason`, `strengths`, `concerns`, `sponsorship`, `evidenceQuotes`, `techStack`, `isRemote`, `salary`).
2. **Local AI Fallback: Ollama (`qwen2.5:latest`):** If `USE_OLLAMA=true`, queries local Ollama instance on `http://localhost:11434`.
3. **Calibrated Heuristic Fallback Engine:** If no external AI keys are available, runs a zero-crash, deterministic rule engine:
   * Base score: 65.
   * Seniority bonus: +20 for Staff/Principal/Architect/Lead; +12 for Senior.
   * Tech stack regex weights: Distributed Systems (+6), Kafka/Streaming (+5), AI Agents/LLM (+8), Python/Java (+4), AWS (+3), Postgres/SQL (+3), Docker/DevOps (+3), Scalability (+5).
   * Location & Sponsorship check: +5 for explicit Tokyo/Seoul or stated visa sponsorship; labels sponsorship as `explicit`, `possible`, or `unconfirmed`.
   * Bounds score between 50 and 99.

---

## 6. Persistence & Storage Architecture

The codebase contains a **Dual Persistence Model**:

### 6.1 Primary Runtime Store: Local JSON Store ([`lib/storage.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/storage.ts))
The interactive dashboard, manual scanner, and background daemon read and persist to atomic JSON files under `data/`:
* [`data/jobs.json`](file:///C:/Luminary/Projects/job-appy-assist/data/jobs.json): Canonical pool of all open, closed, and duplicate-flagged postings.
* [`data/companies.json`](file:///C:/Luminary/Projects/job-appy-assist/data/companies.json): Dynamic watchlist of tracked employers and RSS endpoints.
* [`data/profile.json`](file:///C:/Luminary/Projects/job-appy-assist/data/profile.json): Calibrated candidate profile, preferences, and dealbreakers.
* [`data/runs.json`](file:///C:/Luminary/Projects/job-appy-assist/data/runs.json): Historical scan log metadata.
* [`data/scans/`](file:///C:/Luminary/Projects/job-appy-assist/data/scans/): Timestamped raw scan snapshots (`scan_YYYY-MM-DDTHH-MM-SS-MSZ.json`) and rate limit status (`rate_limit.json`).

### 6.2 Relational Model: Neon PostgreSQL + Drizzle ORM ([`lib/schema.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/schema.ts), [`lib/db.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/db.ts), [`lib/sync.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/sync.ts))
Built with Drizzle ORM schemas targeting Neon Serverless Postgres:
* `companies`: Table of tracked employers with ATS types and active status flags.
* `job_postings`: Table storing `company_id`, `external_id`, `title`, `location`, `apply_url`, `ats_posted_at`, `status` (`'open' | 'closed'`), with unique constraints and indexing.
* `check_runs`: Execution audit trail recording companies checked, new postings, closed postings, and error dumps.
* `syncAll()` in [`lib/sync.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/sync.ts) detects closed roles by diffing currently active postings against external ATS results (`notInArray`).

---

## 7. API Endpoints Reference

All routes are located under [`app/api/`](file:///C:/Luminary/Projects/job-appy-assist/app/api/):

| Endpoint | Method | Purpose & Flow |
| :--- | :--- | :--- |
| [`/api/jobs`](file:///C:/Luminary/Projects/job-appy-assist/app/api/jobs/route.ts) | `GET` | Fetches canonical jobs. Supports `?distinct=true&minScore=65&limit=50` to group by employer, elect highest-scoring hero opening, and group secondary roles. |
| [`/api/scan/manual`](file:///C:/Luminary/Projects/job-appy-assist/app/api/scan/manual/route.ts) | `GET` / `POST` | `GET` checks 5-min cooldown remaining. `POST` executes concurrent live scan across all active watchlist sources, runs deduplication/scoring, saves results, and triggers Telegram alerts. |
| [`/api/companies`](file:///C:/Luminary/Projects/job-appy-assist/app/api/companies/route.ts) | `GET` / `POST` / `PATCH` | Manages employer watchlist: list all, add employer (`name, ats, slug`), or toggle `isActive`. |
| [`/api/eval/url`](file:///C:/Luminary/Projects/job-appy-assist/app/api/eval/url/route.ts) | `POST` | Evaluates arbitrary URL. Extracts job description, scores with LLM/heuristics, and optionally saves directly to [`data/jobs.json`](file:///C:/Luminary/Projects/job-appy-assist/data/jobs.json). |
| [`/api/review/resolve`](file:///C:/Luminary/Projects/job-appy-assist/app/api/review/resolve/route.ts) | `POST` | Resolves duplicate queue items: `action: 'merge'` (attaches evidence to target and closes duplicate) or `action: 'confirm_distinct'` (promotes to `open`). |
| [`/api/profile`](file:///C:/Luminary/Projects/job-appy-assist/app/api/profile/route.ts) | `GET` / `PUT` | Fetches or updates candidate profile in [`data/profile.json`](file:///C:/Luminary/Projects/job-appy-assist/data/profile.json). |
| [`/api/scans`](file:///C:/Luminary/Projects/job-appy-assist/app/api/scans/route.ts) | `GET` | Lists historical scan runs metadata. |
| [`/api/scans/[id]`](file:///C:/Luminary/Projects/job-appy-assist/app/api/scans/[id]/route.ts) | `GET` | Retrieves full snapshot of jobs detected in a specific scan ID. |
| [`/api/cron/check-jobs`](file:///C:/Luminary/Projects/job-appy-assist/app/api/cron/check-jobs/route.ts) | `GET` | Cron endpoint protected by `Bearer ${CRON_SECRET}` that triggers database synchronization via `syncAll()`. |
| [`/api/webhooks/broadcast`](file:///C:/Luminary/Projects/job-appy-assist/app/api/webhooks/broadcast/route.ts) | `POST` | Ingestion hook for inbound push notifications from external channels. |

---

## 8. Background Workers & Automation

### 8.1 Standalone Polling Daemon ([`scripts/scheduler.ts`](file:///C:/Luminary/Projects/job-appy-assist/scripts/scheduler.ts))
A persistent TypeScript worker executable via `pnpm worker` or `pnpm scan` (using `tsx`):
* **Target Schedule:** Configured for **9:00 AM & 9:00 PM IST** (03:30 & 15:30 UTC).
* Calculates exact delay to next target window and sleeps using timer cascades.
* Executes full parallel crawl over all active companies in [`data/companies.json`](file:///C:/Luminary/Projects/job-appy-assist/data/companies.json).
* Runs two-tier deduplication against [`data/jobs.json`](file:///C:/Luminary/Projects/job-appy-assist/data/jobs.json).
* Identifies fresh qualifying roles (`score >= 70 && status === 'open' && isNewInCurrentScan`).
* Dispatches Telegram digest and persists new scan snapshots atomically.

### 8.2 Rate Limiting Safeguards ([`lib/storage.ts#L245-L281`](file:///C:/Luminary/Projects/job-appy-assist/lib/storage.ts#L245-L281))
* A 300-second (5-minute) cooldown is enforced for manual scans via [`data/scans/rate_limit.json`](file:///C:/Luminary/Projects/job-appy-assist/data/scans/rate_limit.json) to prevent accidental ATS API rate-limiting or IP bans.

---

## 9. Telegram Alerting Engine ([`lib/telegram.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/telegram.ts))

* Generates Markdown-formatted alerts after every scan cycle.
* **Freshness Guarantee:** Alerts strictly on fresh qualifying roles discovered during the current scan run (`score >= 70`, `status === 'open'`, `isNewInCurrentScan === true`).
* **Format:** Includes match score badge (`🌟 90+` / `✨ 70-89`), title, company, location, stated salary, sponsorship category, AI executive rationale, and direct application link.
* **Zero-New-Roles Health Check:** If no new roles meet the threshold, dispatches a source health report confirming feeder status.
* **Safe Fallback:** If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` are missing, logs structured mock payloads without throwing exceptions.

---

## 10. Frontend Glassmorphic Command Center ([`app/page.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/page.tsx))

The frontend is an interactive Next.js client-side application styled with Tailwind CSS and Framer Motion:
1. **Top Distinct Company Openings Engine:**
   * Groups candidate-matched postings by employer (`distinct=true&minScore=65&limit=50`).
   * Displays the highest-scoring opening as the representative hero card.
   * Features an interactive accordion displaying `+N other roles at this company` with individual scores and apply links.
2. **Slide-Out AI Deep-Dive Drawer:**
   * Clicking any job opens a blurred slide-out panel detailing match score, executive match summary, bulleted strengths, potential concerns, and direct evidence quotes.
3. **Dedicated Operational Views:**
   * **Fresh Matches:** Hero distinct company cards.
   * **All Active Postings:** Filterable, searchable repository of all ingested roles.
   * **Review Queue:** Side-by-side comparison for fuzzy duplicates with `Merge` or `Confirm Distinct` buttons.
   * **Watchlist Manager:** Dynamic employer toggles (active/inactive) and modal to register new Greenhouse/Lever/Ashby/SmartRecruiters slugs.
   * **Candidate Profile Editor:** Live JSON and form editor to tune scoring calibration directly from the UI.
   * **Audit & Runs:** History table of previous scan runs with itemized metrics.
   * **Universal URL Evaluation Bar:** Instant paste-and-evaluate bar with real-time scoring.

---

## 11. Environment Configuration

Defined in `.env.local`:

```env
# Google Gemini API Key for semantic job fit evaluation
GEMINI_API_KEY=your_gemini_api_key

# Optional: Local Ollama Configuration
USE_OLLAMA=false
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:latest

# Telegram Bot Notifications
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# Database Configuration (Neon Serverless Postgres)
DATABASE_URL=postgres://user:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require

# Cron Secret for Vercel Cron Endpoint Protection
CRON_SECRET=your_cron_shared_secret
```

---

## 12. Key Project Files Sitemap

* [`package.json`](file:///C:/Luminary/Projects/job-appy-assist/package.json): Dependencies, `pnpm` enforcement, scripts (`dev`, `build`, `scan`, `worker`).
* [`GEMINI.md`](file:///C:/Luminary/Projects/job-appy-assist/GEMINI.md): Project context, mission, and operational rules.
* [`lib/ai-evaluator.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/ai-evaluator.ts): Deterministic gate, Gemini 2.5 Flash API client, Ollama connector, and calibrated heuristic rules.
* [`lib/ats-adapters.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/ats-adapters.ts): Adapters for Greenhouse, Lever, Ashby, SmartRecruiters, and RSS feeds.
* [`lib/dedup.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/dedup.ts): URL canonicalizer, Jaccard word similarity, and two-tier deduplication.
* [`lib/url-evaluator.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/url-evaluator.ts): Cheerio HTML scraper and on-demand URL analyzer.
* [`lib/storage.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/storage.ts): Atomic file read/writes for jobs, companies, profiles, runs, and rate limits.
* [`lib/telegram.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/telegram.ts): Markdown digest formatter and Telegram Bot API dispatcher.
* [`lib/schema.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/schema.ts) & [`lib/db.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/db.ts): Drizzle ORM schemas and Neon Postgres client.
* [`lib/sync.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/sync.ts): Relational database synchronization and role closure diffing.
* [`scripts/scheduler.ts`](file:///C:/Luminary/Projects/job-appy-assist/scripts/scheduler.ts): Autonomous background daemon and CLI runner.
* [`app/page.tsx`](file:///C:/Luminary/Projects/job-appy-assist/app/page.tsx): Main Glassmorphic Command Dashboard UI.

---

## 13. Audit Checklist & Reviewer Notes

1. **Storage Unification:** The system currently maintains dual storage paths: the file-based JSON store ([`lib/storage.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/storage.ts)) used by the dashboard and scheduler, and the relational Drizzle/Postgres store ([`lib/sync.ts`](file:///C:/Luminary/Projects/job-appy-assist/lib/sync.ts)). An auditing agent should evaluate whether unifying these paths is required for cloud multi-instance deployments.
2. **Dynamic SPA Crawling:** Universal URL evaluation relies on Cheerio static DOM parsing. For SPAs that load descriptions purely via client-side JavaScript, a headless browser fallback (Playwright) may be considered.
3. **Jaccard Similarity Threshold:** The current Level 2 deduplication threshold is set to 0.60. Validate against edge cases with near-identical titles across different levels (e.g. "Software Engineer II" vs "Software Engineer III").
4. **LLM Quota Management:** Deep LLM evaluation is intentionally capped at the top 5 fresh qualifying jobs per run to prevent rate-limit degradation and cost spikes.
