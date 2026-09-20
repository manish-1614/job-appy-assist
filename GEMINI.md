# GEMINI.md - JobAppy Assist Project Context & Master Directives

## 1. Operating contract (non-negotiable)

* **Documentation-first, phase-gated.** For each phase: write `docs/phases/PHASE-N.md` (goal, design, task list, test plan, rollback) → **stop and wait for approval** → implement → write the Phase Report (section 11 of master instruction) → stop.
* **Test-first for every bug.** Reproduce with a failing test using real fixtures from `data/jobs.json`, then fix. Framework: `vitest`.
* **Never destructive on data.** Before any change touching `data/`, copy it to `data-backup/<timestamp>/`. Migrations are idempotent and reversible.
* **Environment:** Windows 11, `cmd.exe` (no bash-isms in scripts or docs), `pnpm` only, Node LTS. Local-only: bind dev server to `127.0.0.1`.
* **Secrets and personal data:** never print or commit `.env*`, contact details, resume files, or `data/`. Never put API keys in URLs (use headers).
* **Dependencies:** justify each new dependency in the phase doc (why, size, alternative considered).
* **Commits:** one logical change per commit, conventional commit messages. Do not push.
* **Ambiguity:** if a `[DECISION]` is unresolved and no default exists, ask. Do not guess.
* **Zero-fabrication rule (project-wide):** no generated text may state a fact about the candidate, a job, or a company that is not traceable to (a) the verified achievement bank, or (b) a verbatim quote from the job description. Applies to scoring rationale, cover letters, resumes, and Telegram messages.

---

## 2. Product goal and principles

**Goal:** shorten the path from "new opening exists" to "tailored application sent and followed up", for a remote-first search from India (plus Tokyo/Seoul with sponsorship).

**Funnel the tool must serve:** discover → filter by real constraints → tailor → apply → follow up → learn. Discovery is already broad; the gaps are **precision, tailoring, and follow-through**.

**Principles**

* **LLM extracts, code judges.** The LLM extracts structured facts from the JD with supporting quotes; deterministic code computes gates, sub-scores, and tiers. No raw LLM 0–100 number decides anything.
* **Hard constraints are gates, not points.** Location eligibility, role family, comp floor are pass/fail with a stored reason code.
* **Never delete, always explain.** Rejected jobs stay in the store with `gateReason` so scoring can be audited.
* **Human in the loop for outbound.** Nothing is submitted or sent without explicit approval. No auto-submitting ATS forms.

---

## 3. Audited ground truth (do not re-discover; fix)

Numbers from `data/jobs.json` (1,975 jobs), `companies.json` (14 sources), `runs.json` (3 runs).

|#|Finding|Evidence|Impact|
|-|-|-|-|
|F1|`canonicalizeUrl` strips `gh_jid`, which is job identity on company-hosted Greenhouse pages|520 Stripe jobs collapse to `https://stripe.com/jobs/search`; 1,374 stored URLs carry `gh_jid`|Level-1 dedup swallows every new Stripe role after the first scan; closed Stripe roles never detected|
|F2|Title gate uses `includes('intern')`|`lib/ai-evaluator.ts` gate|Drops "**Intern**al Tools", "**Intern**ational …" titles|
|F3|LLM deep-eval receives `contentHtml: job.matchReason` (the heuristic's own boilerplate), not the JD|`scripts/scheduler.ts`|"LLM scoring" is effectively title + company + location only|
|F4|JD text is never persisted|`EvaluatedJob` has no description field|Blocks re-scoring, tailoring, caching, keyword-gap analysis|
|F5|Existing-job `lastSeenAt` updates are lost|scheduler mutates an in-memory pool; `upsertCanonicalJobs` reloads from disk|Staleness undetectable|
|F6|No closed-role detection in the JSON path|`status: 'closed'` never set outside the unused Postgres path|Dead roles stay "open"|
|F7|Score is non-discriminating|median 71; 993/1,975 ≥ 70; 347 ≥ 90 (base 65 + keyword boosts)|Alerts are noise|
|F8|Real constraints are not modeled|283 of 492 jobs scoring ≥ 85 are on-site outside India/JP/KR (e.g. Chicago, Seattle)|Top of the list is mostly unreachable|
|F9|`isRemote` = string contains "remote"|267 ATS jobs flagged remote; 222 name a region (US/EU/…); only 6 name India|"Remote" ≠ remote-from-India|
|F10|RSS location is hardcoded `'Remote / Global'`|292 jobs; 145 are engineering titles|Fabricated eligibility for We Work Remotely jobs|
|F11|Fuzzy dedup strips seniority and ignores location|"Senior SWE (AI/ML), Trust [Bangalore]" flagged duplicate of "Senior Staff SWE, Trust [Remote-US]"; "…Distributed Systems [Bordeaux]" ~ "[Boston]" at conf 1.0|India-eligible roles hidden in the Review Queue (119 flagged)|
|F12|Schema drift|1,386 of 1,975 records lack `status`/`firstSeenAt`/`lastSeenAt`; `/api/jobs?distinct=true` filters `status === 'open'`|~70% of the store (incl. all legacy Stripe/Datadog) is invisible in the main view|
|F13|Fabricated fields|salary = "Salary not stated (Standard Senior Scale)" on 100% of jobs; heuristic "strengths" and `evidenceQuotes` are template strings; Tokyo/Seoul location alone sets `sponsorship: 'explicit'`|Violates zero-fabrication|
|F14|Watchlist skew|Datadog + Stripe = 56% of the pool; the earlier remote-first Tier-A shortlist is mostly not in `companies.json`|Recall is dominated by on-site-heavy US employers|
|F15|"Time since posted" unmet|1,510 Greenhouse jobs show `postedAgo: 'Live Ingestion'` (only `updated_at` is captured, then ignored)|Original requirement unmet|
|F16|Scheduling is not happening|3 runs logged; last scan 2026-09-13; daemon is a long `setTimeout` chain that dies on sleep/reboot|No twice-daily cadence in practice|
|F17|No application tracking|no applied/status/notes/follow-up anywhere|No feedback loop|
|F18|Ops/security hygiene|Telegram `parse_mode: 'Markdown'` with unescaped titles (send failures); Gemini key in URL query; `sourcesChecked: 10` hardcoded; SSRF guard is protocol-only; no webhook secret; `saveScanResult` per broadcast creates a scan file each time|Reliability and safety|
|F19|**Repo is public and `data/` is tracked**|`git ls-files` includes `data/profile.json` (contact details, salary targets) and all scans|Personal data exposed; contradicts "personal use only"|
|F20|Inconsistent floor|`profile.json`: min 25 LPA; `GEMINI.md`: min 35 LPA|Scorer must use one source of truth|

---

## 4. Decisions

|ID|Decision|Default|
|-|-|-|
|D1|Comp|Hard floor **INR 25L** (gate); soft target **35–65L** (score). Single source: `profile.json`; remove conflicting line from `GEMINI.md`|
|D2|Eligible location classes|`remote_worldwide`, `remote_apac_or_india`, `india_office` (hybrid, top-tier employers only), `jp_kr_onsite_sponsored`. Everything else is gated|
|D3|India office cities acceptable|Ranchi, Hyderabad, Pune, Gurgaon/Gurugram, Noida, New Delhi, Bengaluru, Mumbai|
|D4|Contractor / EOR engagement|Allowed, but flagged `engagement: contractor` and shown on the card|
|D5|Timezone overlap ceiling|Flag (not gate) roles requiring > 4h overlap with US Pacific; gate roles requiring overlap during IST 00:00–05:00 daily|
|D6|"Solutions Architect"|Software/cloud architecture = eligible. Pre-sales / partner / sales-engineering = flagged `presales` and down-weighted (not gated)|
|D7|Role-family priority|1) backend/distributed/platform 2) AI/agentic/applied-AI 3) architect 4) full-stack (backend-heavy). Frontend-only, mobile-only, pure data-science research = gated|
|D8|Japan/Korea track|Enabled; Japan-telecom/SaaS domain affinity on|
|D9|Models (env, not hardcoded)|`MODEL_EXTRACT` (Gemini Flash-class), `MODEL_WRITE` (best available writer), `MODEL_LOCAL` (Ollama, optional triage)|
|D10|Storage|**SQLite via Drizzle (`better-sqlite3`)**; JSON kept only as import source and export. Neon/Vercel path frozen, not deleted|
|D11|Weekly applications goal|10 ; drives dashboard progress and reminders|

---

## 5. Target architecture

```
sources (ATS adapters, RSS, URL paste, browser-bookmark paste)
  → normalize (RawJob, stable identity: ats+slug+externalId)
  → persist JD text + content hash
  → gate 1: role/seniority (word-boundary regex, role-family classifier)
  → LLM extraction (schema-enforced, quotes validated verbatim)   [cached by hash+promptVersion+model]
  → gate 2: eligibility (location class, comp floor, engagement)
  → scorer v2 (deterministic sub-scores → tier A/B/C)
  → SQLite  →  Dashboard (Today, Pipeline, Jobs, Kit, Insights)  →  Telegram (Tier A + follow-ups due)
                                                  ↘ Application Kit (tailor → validate → approve → Gmail draft)
```

Scheduling: **Windows Task Scheduler** runs `pnpm scan` twice daily with "run as soon as possible after a missed start". The `worker` daemon is deprecated.

---

## 6. Calibrated Candidate Profile

The evaluation engine is calibrated against the candidate profile defined in `data/profile.json`:

* **Candidate:** Manish Kumar Prajapati
* **Experience:** ~8.5+ Years
* **Current Role:** Software Engineer (Advanced) at Amdocs
* **Core Domains:**
  * Distributed Systems & High-Throughput Microservices
  * CRM SaaS Architecture (millions of users, 40% latency reduction)
  * AI Agent Orchestration & LLMs (Smriti: zero-fabrication companion, vector embeddings, cosine similarity)
* **Core Technologies:**
  * **Languages:** Java, Python, TypeScript/JavaScript, SQL
  * **Frameworks & Backend:** Spring Boot, FastAPI, Node.js, Express
  * **Streaming & Messaging:** Apache Kafka, Event-Driven Architecture, Pub/Sub
  * **Databases & Storage:** PostgreSQL, MySQL, Redis, Vector DBs
  * **Cloud & DevOps:** AWS (S3, RDS, EC2), Docker, Kubernetes, CI/CD
* **Target Roles:** Staff Software Engineer, Principal Engineer, Lead Engineer, Senior Backend Engineer, Distributed Systems Architect, AI Systems Engineer
* **Target Locations & Compensation:**
  * **Locations:** Remote (Worldwide / India) or Relocation to Japan (Tokyo) / South Korea (Seoul)
  * **Target Compensation:** INR 35–65 LPA (Hard floor INR 25L per D1 and `data/profile.json`)

---

## 7. Development & Command Reference

All commands must be executed using `pnpm` and `cmd.exe`-compatible syntax:

```bash
# Install dependencies
pnpm install

# Start local Next.js dev server (bound to 127.0.0.1)
pnpm dev

# Build production bundle
pnpm build

# Run Next.js production server
pnpm start

# Run unit / characterization tests
pnpm test

# Run ESLint validation
pnpm lint

# Trigger a one-time full scan across tracked ATS companies & feeds
pnpm scan
```

---

## 8. Environment Variables

Configure `.env.local` (ensure it is never committed):

```env
# Gemini API Key for semantic candidate-job extraction
GEMINI_API_KEY=your_google_ai_gemini_key

# Models
MODEL_EXTRACT=gemini-2.5-flash
MODEL_WRITE=gemini-2.5-flash

# Optional: Local Ollama fallback
USE_OLLAMA=false
OLLAMA_HOST=http://localhost:11434

# Optional: Telegram bot notifications for fresh role alerts
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
```
