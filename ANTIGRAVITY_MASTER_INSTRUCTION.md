# JobAppy Assist — Elite Upgrade: Master Instruction for antigravity-cli

Repo audited: `manish-1614/job-appy-assist` @ `f886c96`. Local-only, single-user tool. Not a showcase project.

## 0\. How to use this file

1. Copy sections 1–5 into `GEMINI.md` (durable rules and ground truth the agent re-reads every session).
2. Edit the **Decisions** table (section 4) before the first run.
3. Run **one phase at a time** using the kickoff prompt in section 12. Each phase ends with a written report and a hard stop for your approval. Do not let the agent chain phases.

\---

## 1\. Operating contract (non-negotiable)

* **Documentation-first, phase-gated.** For each phase: write `docs/phases/PHASE-N.md` (goal, design, task list, test plan, rollback) → **stop and wait for approval** → implement → write the Phase Report (section 11) → stop.
* **Test-first for every bug.** Reproduce with a failing test using real fixtures from `data/jobs.json`, then fix. Framework: `vitest`.
* **Never destructive on data.** Before any change touching `data/`, copy it to `data-backup/<timestamp>/`. Migrations are idempotent and reversible.
* **Environment:** Windows 11, `cmd.exe` (no bash-isms in scripts or docs), `pnpm` only, Node LTS. Local-only: bind dev server to `127.0.0.1`.
* **Secrets and personal data:** never print or commit `.env\*`, contact details, resume files, or `data/`. Never put API keys in URLs (use headers).
* **Dependencies:** justify each new dependency in the phase doc (why, size, alternative considered).
* **Commits:** one logical change per commit, conventional commit messages. Do not push.
* **Ambiguity:** if a `\[DECISION]` is unresolved and no default exists, ask. Do not guess.
* **Zero-fabrication rule (project-wide):** no generated text may state a fact about the candidate, a job, or a company that is not traceable to (a) the verified achievement bank, or (b) a verbatim quote from the job description. Applies to scoring rationale, cover letters, resumes, and Telegram messages.

\---

## 2\. Product goal and principles

**Goal:** shorten the path from "new opening exists" to "tailored application sent and followed up", for a remote-first search from India (plus Tokyo/Seoul with sponsorship).

**Funnel the tool must serve:** discover → filter by real constraints → tailor → apply → follow up → learn. Discovery is already broad; the gaps are **precision, tailoring, and follow-through**.

**Principles**

* **LLM extracts, code judges.** The LLM extracts structured facts from the JD with supporting quotes; deterministic code computes gates, sub-scores, and tiers. No raw LLM 0–100 number decides anything.
* **Hard constraints are gates, not points.** Location eligibility, role family, comp floor are pass/fail with a stored reason code.
* **Never delete, always explain.** Rejected jobs stay in the store with `gateReason` so scoring can be audited.
* **Human in the loop for outbound.** Nothing is submitted or sent without explicit approval. No auto-submitting ATS forms.

\---

## 3\. Audited ground truth (do not re-discover; fix)

Numbers from `data/jobs.json` (1,975 jobs), `companies.json` (14 sources), `runs.json` (3 runs).

|#|Finding|Evidence|Impact|
|-|-|-|-|
|F1|`canonicalizeUrl` strips `gh\_jid`, which is job identity on company-hosted Greenhouse pages|520 Stripe jobs collapse to `https://stripe.com/jobs/search`; 1,374 stored URLs carry `gh\_jid`|Level-1 dedup swallows every new Stripe role after the first scan; closed Stripe roles never detected|
|F2|Title gate uses `includes('intern')`|`lib/ai-evaluator.ts` gate|Drops "**Intern**al Tools", "**Intern**ational …" titles|
|F3|LLM deep-eval receives `contentHtml: job.matchReason` (the heuristic's own boilerplate), not the JD|`scripts/scheduler.ts`|"LLM scoring" is effectively title + company + location only|
|F4|JD text is never persisted|`EvaluatedJob` has no description field|Blocks re-scoring, tailoring, caching, keyword-gap analysis|
|F5|Existing-job `lastSeenAt` updates are lost|scheduler mutates an in-memory pool; `upsertCanonicalJobs` reloads from disk|Staleness undetectable|
|F6|No closed-role detection in the JSON path|`status: 'closed'` never set outside the unused Postgres path|Dead roles stay "open"|
|F7|Score is non-discriminating|median 71; 993/1,975 ≥ 70; 347 ≥ 90 (base 65 + keyword boosts)|Alerts are noise|
|F8|Real constraints are not modeled|283 of 492 jobs scoring ≥ 85 are on-site outside India/JP/KR (e.g. Chicago, Seattle)|Top of the list is mostly unreachable|
|F9|`isRemote` = string contains "remote"|267 ATS jobs flagged remote; 222 name a region (US/EU/…); only 6 name India|"Remote" ≠ remote-from-India|
|F10|RSS location is hardcoded `'Remote / Global'`|292 jobs; 145 are engineering titles|Fabricated eligibility for We Work Remotely jobs|
|F11|Fuzzy dedup strips seniority and ignores location|"Senior SWE (AI/ML), Trust \[Bangalore]" flagged duplicate of "Senior Staff SWE, Trust \[Remote-US]"; "…Distributed Systems \[Bordeaux]" \~ "\[Boston]" at conf 1.0|India-eligible roles hidden in the Review Queue (119 flagged)|
|F12|Schema drift|1,386 of 1,975 records lack `status`/`firstSeenAt`/`lastSeenAt`; `/api/jobs?distinct=true` filters `status === 'open'`|\~70% of the store (incl. all legacy Stripe/Datadog) is invisible in the main view|
|F13|Fabricated fields|salary = "Salary not stated (Standard Senior Scale)" on 100% of jobs; heuristic "strengths" and `evidenceQuotes` are template strings; Tokyo/Seoul location alone sets `sponsorship: 'explicit'`|Violates zero-fabrication|
|F14|Watchlist skew|Datadog + Stripe = 56% of the pool; the earlier remote-first Tier-A shortlist is mostly not in `companies.json`|Recall is dominated by on-site-heavy US employers|
|F15|"Time since posted" unmet|1,510 Greenhouse jobs show `postedAgo: 'Live Ingestion'` (only `updated\_at` is captured, then ignored)|Original requirement unmet|
|F16|Scheduling is not happening|3 runs logged; last scan 2026-09-13; daemon is a long `setTimeout` chain that dies on sleep/reboot|No twice-daily cadence in practice|
|F17|No application tracking|no applied/status/notes/follow-up anywhere|No feedback loop|
|F18|Ops/security hygiene|Telegram `parse\_mode: 'Markdown'` with unescaped titles (send failures); Gemini key in URL query; `sourcesChecked: 10` hardcoded; SSRF guard is protocol-only; no webhook secret; `saveScanResult` per broadcast creates a scan file each time|Reliability and safety|
|F19|**Repo is public and `data/` is tracked**|`git ls-files` includes `data/profile.json` (contact details, salary targets) and all scans|Personal data exposed; contradicts "personal use only"|
|F20|Inconsistent floor|`profile.json`: min 25 LPA; `GEMINI.md`: min 35 LPA|Scorer must use one source of truth|

\---

## 4\. Decisions 

|ID|Decision|Default|
|-|-|-|
|D1|Comp|Hard floor **INR 25L** (gate); soft target **35–65L** (score). Single source: `profile.json`; remove the conflicting line from `GEMINI.md`|
|D2|Eligible location classes|`remote\_worldwide`, `remote\_apac\_or\_india`, `india\_office` (hybrid, top-tier employers only), `jp\_kr\_onsite\_sponsored`. Everything else is gated|
|D3|India office cities acceptable|Ranchi, Hyderabad, Pune, Gurgaon/Gurugram, Noida, New Delhi, Bengaluru, Mumbai|
|D4|Contractor / EOR engagement|Allowed, but flagged `engagement: contractor` and shown on the card|
|D5|Timezone overlap ceiling|Flag (not gate) roles requiring > 4h overlap with US Pacific; gate roles requiring overlap during IST 00:00–05:00 daily|
|D6|"Solutions Architect"|Software/cloud architecture = eligible. Pre-sales / partner / sales-engineering = flagged `presales` and down-weighted (not gated)|
|D7|Role-family priority|1) backend/distributed/platform 2) AI/agentic/applied-AI 3) architect 4) full-stack (backend-heavy). Frontend-only, mobile-only, pure data-science research = gated|
|D8|Japan/Korea track|Enabled; Japan-telecom/SaaS domain affinity on|
|D9|Models (env, not hardcoded)|`MODEL\_EXTRACT` (Gemini Flash-class), `MODEL\_WRITE` (best available writer), `MODEL\_LOCAL` (Ollama, optional triage)|
|D10|Storage|**SQLite via Drizzle (`better-sqlite3`)**; JSON kept only as import source and export. Neon/Vercel path frozen, not deleted|
|D11|Weekly applications goal|10 ; drives dashboard progress and reminders|

\---

## 5\. Target architecture

```
sources (ATS adapters, RSS, URL paste, browser-bookmark paste)
  → normalize (RawJob, stable identity: ats+slug+externalId)
  → persist JD text + content hash
  → gate 1: role/seniority (word-boundary regex, role-family classifier)
  → LLM extraction (schema-enforced, quotes validated verbatim)   \[cached by hash+promptVersion+model]
  → gate 2: eligibility (location class, comp floor, engagement)
  → scorer v2 (deterministic sub-scores → tier A/B/C)
  → SQLite  →  Dashboard (Today, Pipeline, Jobs, Kit, Insights)  →  Telegram (Tier A + follow-ups due)
                                                  ↘ Application Kit (tailor → validate → approve → Gmail draft)
```

Scheduling: **Windows Task Scheduler** runs `pnpm scan` twice daily with "run as soon as possible after a missed start". The `worker` daemon is deprecated.

\---

## 6\. Phases

Each phase: doc → approval → implement → report → stop. Sizes are relative (S/M/L).

### Phase 0 — Safety net and hygiene (S)

* Add `vitest`; write **characterization tests** capturing current behavior for `canonicalizeUrl`, `passesDeterministicGate`, `checkJobDeduplication`, `evaluateRawJob`.
* Snapshot `data/` to `data-backup/`.
* Untrack `data/`, `data-backup/`, `\*.pdf`, `.env\*` in `.gitignore`; `git rm -r --cached data`. (Manual step for the user, listed in the report: make the GitHub repo private and purge history or recreate the repo; rotate anything sensitive.)
* Bind dev server to `127.0.0.1`; move Gemini key to the `x-goog-api-key` header; Telegram → `parse\_mode: 'HTML'` with escaping.
* **Accept:** tests green; `git ls-files` shows no data files; Phase Report lists the manual steps.

### Phase 1 — Correctness and storage (L)

1. **Identity:** primary key `(ats, slug, externalId)`; canonical URL secondary. Strip only true tracking params (`utm\_\*`, `gh\_src`, `lever-origin`). Keep `gh\_jid`. *(F1)*
2. **Gate:** word-boundary regex; add role-family classifier stub. *(F2)*
3. **SQLite + Drizzle schema:** `jobs`, `job\_descriptions`(text, content\_hash), `job\_events`, `sources`, `runs`, plus tables reserved for later phases (`applications`, `application\_events`, `kit\_\*`). Migration imports `jobs.json` idempotently; **backfill** `status/firstSeenAt/lastSeenAt` for the 1,386 legacy rows, re-deriving identity from `id`. *(F4, F12)*
4. **Persist JD text** (HTML → clean text, entities decoded) for every job. *(F4)*
5. **Lifecycle:** update `lastSeenAt` in the DB on every sighting; close a job only after **2 consecutive scans** without it; treat empty/>50%-drop fetches as a failed source (no closures); silent baseline for first scan of a source; `reopened` event when it returns. *(F5, F6)*
6. **Freshness:** capture `first\_published`/`updated\_at` (Greenhouse), `createdAt` (Lever), `publishedAt` (Ashby); compute "posted N days ago" from stored dates, fall back to `firstSeenAt`. *(F15)*
7. **Dedup v2:** identity match first; fuzzy only within the same company **and** same normalized location set **and** title similarity **with seniority tokens retained**; add description-similarity check (shingle/Jaccard on JD text) before flagging; auto-resolve high-confidence cases so the Review Queue stays near-empty. *(F11)*
8. **RSS:** configure `rss-parser` `customFields` to read region/country fields if present (verify in the feed); otherwise mark location `unknown`, never `'Remote / Global'`. *(F10)*
9. **Ops:** Task Scheduler setup script (`scripts/install-schedule.cmd`), lock file to prevent overlapping scans, real `sourcesChecked`, per-source health (last success, count delta, HTTP status), dashboard banner "last scan N hours ago". *(F16, F18)*
* **Accept:** regression tests for F1, F2, F5, F6, F11 pass using real fixtures (Stripe URLs; the Bangalore-vs-US Trust pair; "Internal Tools"); migrated DB row count ≥ 1,975 with zero null statuses; a simulated second scan surfaces a *new* Stripe job; dashboard main view shows all migrated open jobs.

### Phase 2 — Constraint-aware scorer v2 (L)

Implement section 7 exactly. Deliverables: extraction module, gates, sub-scores, tiers, `pnpm eval` harness, "explain" panel in the drawer (gate result, sub-scores, quotes).

* **Labeling:** add 👍/👎 (+ reason code) on cards; `pnpm eval` reports precision@10/@25 per tier against labels; require ≥ 60 labels before tuning weights.
* **Accept:** zero raw-LLM-number decisions; every stored field has a quote or is `unknown`; the current 1,975 jobs re-scored offline; Tier A contains no job with `eligibility ∈ {region\_locked, onsite\_elsewhere}`; report shows the score distribution (Tier A ≤ \~5% of jobs).

### Phase 3 — Application tracker and follow-ups (M)

Implement section 8. Deliverables: Pipeline (kanban) tab, Today view, reminders in Telegram digest, funnel analytics, `applications` CRUD API.

* **Accept:** one-click "Applied" from any card; state changes append `application\_events`; scans never overwrite tracker fields; a closed job that has an application triggers an alert; weekly goal shown.

### Phase 4 — Application kit: resume and cover letter (L)

Implement section 9. Deliverables: achievement bank, resume variants, tailoring pipeline with validator, cover-letter generator, DOCX/PDF export, Gmail **draft** creation, screening-answer bank.

* **Accept:** validator rejects a generated bullet containing an unbanked number/tool/employer (unit-tested with adversarial cases); every kit output shows a gap list; kit versions link to `applications.resumeVersionId`.

### Phase 5 — Recall, sources, and insights (M)

* Company onboarding: `pnpm add-company <careers-url>` auto-detects ATS (Greenhouse/Lever/Ashby/SmartRecruiters via URL and page/network hints) and writes a `sources` row.
* Seed the remote-first Tier-A shortlist from prior triage (user supplies slugs found via DevTools).
* Per-company contribution cap in the "Top distinct" view so no employer exceeds 20% of the list.
* New adapters (verify public endpoints and terms first): Workable, Recruitee, BambooHR, Personio, plus remote-focused public feeds and the monthly HN "Who is hiring" thread (Algolia API).
* Japan/Korea sources behind the D8 flag.
* **Skill-gap panel:** aggregate extracted `mustHaveTech` across Tier A/B → "top missing skills".
* **Accept:** ≥ 30 active sources; no single company > 20% of Tier A/B; skill-gap panel renders from real data.

### Phase 6 (optional) — Inbound signal and network

* Gmail read-only sync (local OAuth) to detect interview/rejection emails and *propose* status changes (user confirms).
* LinkedIn Connections.csv import → "people you know at X" badge and referral-note drafts.
* Telegram inline buttons via **long-polling** (`getUpdates`), so no public URL is needed.

\---

## 7\. Scorer v2 specification

### 7.1 Extraction (LLM → structured facts, schema-enforced, temperature 0)

Input: full cleaned JD (no truncation), title, location string, company. Output fields, each with `quote` (verbatim substring of the JD or location string) or `null`:

`remoteScope` ∈ {worldwide, apac, india, region\_locked, hybrid, onsite, unknown} · `allowedCountries\[]` · `excludedCountries\[]` · `tzOverlap` · `engagement` ∈ {employee, contractor, eor, unknown} · `salary{min,max,currency,period}` · `visaSponsorship` ∈ {explicit, none, unknown} · `seniority` · `roleFamily` · `mustHaveTech\[]` · `niceToHaveTech\[]` · `yearsRequired` · `domainTags\[]` · `presales` (bool).

**Validation (code):** drop any field whose quote is not a verbatim substring (case/whitespace-normalized) → value becomes `unknown`. Cache key = `sha256(JD) + promptVersion + model`. Store `model`, `promptVersion`, `extractedAt`. Concurrency ≤ 4 with exponential backoff; on failure store `extractionStatus: failed` and retry next scan (never silently substitute a heuristic score).

### 7.2 Gates (deterministic; store `gateReason`)

* **G-role:** seniority/title exclusions (word-boundary); role family ∈ allowed set (D7); `presales` → flag only (D6).
* **G-eligibility:** map to a location class (D2/D3). `region\_locked` (allowed countries exclude India), `onsite\_elsewhere`, and IST-hostile overlap (D5) → gated. `unknown` → **quarantine** (status `needs\_check`), never Tier A.
* **G-comp:** stated max < hard floor (D1, FX from config) → gated. Unstated → neutral.
* **G-sponsorship:** Japan/Korea on-site requires `visaSponsorship = explicit`; otherwise gated.

### 7.3 Sub-scores (each 0–1, all visible in the UI)

|Sub-score|Weight (initial; tune on labels)|Notes|
|-|-|-|
|roleFit|0.30|role family priority (D7) × title match|
|stackOverlap|0.20|`mustHaveTech` ∩ candidate skills, must-haves weighted 2× nice-to-haves; word-boundary matching only|
|reachability|0.15|candidate years vs `yearsRequired`/seniority; **Staff/Principal is not auto-boosted**; reflects realistic conversion odds|
|domainAffinity|0.10|telecom/BSS/OSS/CRM/billing, Japan-telecom, AI-platform tags|
|freshness|0.10|days since first published; ghost-job penalty (> 90 days open, repeated reposts)|
|compFit|0.10|position of stated range vs 35–65L target after FX; neutral if unstated|
|companySignal|0.05|posting velocity for the company, remote-first flag|

`score = round(100 × Σ wᵢ·sᵢ)`.

### 7.4 Tiers and alerts

* **Tier A:** passed all gates, `score ≥ 75` (calibrate), eligibility ≠ unknown → Telegram + top of dashboard.
* **Tier B:** passed gates, 60–74.
* **Tier C / gated:** hidden by default, filterable, reason shown.

### 7.5 Profile hygiene

Move candidate skills to a `verified: true|false` model in `profile.json`. Only `verified` skills count in stack overlap and in the kit. Remove any skill without real hands-on experience.

\---

## 8\. Application tracker specification

**States:** `saved → applied → screening → interview(round n) → offer → accepted | rejected | withdrawn | ghosted`.
**Fields:** `jobId`, `appliedAt`, `channel` (direct/referral/recruiter/other), `resumeVersionId`, `coverLetterId`, `contacts\[]`, `nextFollowUpAt`, `notes`, `outcomeReason`.
**Events:** append-only `application\_events(type, at, payload)`; the current state is derived, never overwritten by scans.

**Follow-up cadence (defaults; editable):** applied → nudge at +7d (draft short follow-up if a contact exists), second at +14d, suggest `ghosted` at +30d; after an interview → thank-you draft within 24h and an "expected decision" prompt.

**Today view:** follow-ups due, new Tier A since last visit, saved jobs at risk of closing (based on age/velocity), weekly-goal progress (D11).
**Insights:** funnel counts and response rate by source, tier, role family, channel (referral vs cold), and resume variant; median time to first response.
**Guardrails:** tracker fields are excluded from scan upserts; closing of a tracked job raises an alert.

\---

## 9\. Application kit specification (resume and cover letter)

### 9.1 Inputs (user-owned, gitignored)

* `data/kit/achievements.json`: `{id, employer|project, claim, metric, period, evidence, skills\[]}`. Seed from `profile.json → highlightedProjects` and then **stop and ask the user to verify and extend**. The agent must never invent achievements.
* `data/kit/resumes/{backend-distributed,ai-agentic,architect}.json`: base variants (structured, ATS-safe: single column, no tables/icons).
* `data/kit/answers.json`: screening-answer bank (notice period, current/expected CTC, relocation, work authorization, links). Empty until the user fills it.

### 9.2 Pipeline (per selected job)

1. Load extracted requirements (`mustHaveTech`, `niceToHaveTech`, domain tags).
2. Map requirements → achievement IDs; compute coverage; list **gaps** (requirements with no banked evidence — shown, never papered over).
3. Pick the closest resume variant; select/reorder bullets (≤ N per role); allow rephrasing only to match JD terminology when the meaning is identical.
4. **Validator (hard):** every number, tool, employer, and outcome in the output must appear in the referenced achievements; any new named technology → reject and regenerate; max 2 retries, then return the deterministic (unrephrased) version.
5. Cover letter (180–230 words): a company/role-specific opening drawn only from JD text, two proof points with banked metrics, one honest line on a gap if material, clear close. No superlatives, no filler.
6. Show a **diff against the base resume** and the gap list; require explicit "Approve".
7. Export DOCX (and PDF via print stylesheet); store the version and link it to the application.
8. **Send path:** create a **Gmail draft** (scope limited to compose) with attachments when a recruiter/referral email exists; otherwise copy-ready text plus the screening-answer cheat sheet for the ATS form. **Never auto-send and never auto-submit an ATS form.**

### 9.3 Follow-up drafts

Reuse the same validator. Drafts reference only the application record and banked facts.

\---

## 10\. Non-goals

* No auto-apply, no form-filling bots, no scraping of LinkedIn or aggregator sites.
* No cloud deployment, multi-user auth, or public hosting.
* No new UI framework or rewrite of `app/page.tsx`; split it into components only where a phase touches it.
* No changes to `profile.json` content without asking; propose diffs instead.

\---

## 11\. Phase Report template (agent must produce at the end of every phase)

1. **What changed** (files, migrations, dependencies added and why)
2. **Evidence** (test output, before/after numbers against section 3 findings)
3. **Behavior changes** the user will notice
4. **Known gaps / risks**
5. **Manual steps for the user**
6. **Open questions** and `\[DECISION]` items
7. **Proposed next-phase scope** (then STOP)

\---

## 12\. Kickoff prompt (paste per phase; replace N)

```
Read GEMINI.md and docs/ANTIGRAVITY\_MASTER\_INSTRUCTION.md fully. You are executing Phase N only.

Rules: follow section 1 (Operating contract) strictly. Start by writing docs/phases/PHASE-N.md
(goal, design, task list, test plan, rollback) using the acceptance criteria in section 6 and the
findings in section 3. Then STOP and wait for my approval. After approval, implement test-first,
commit per task, and finish with the Phase Report (section 11). Do not begin Phase N+1.
Back up data/ before touching it. Use pnpm and cmd.exe-compatible commands. Ask me about any
unresolved \[DECISION] rather than guessing.
```

