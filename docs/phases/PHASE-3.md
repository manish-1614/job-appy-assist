# Phase 3 — Application Tracker and Follow-ups

> **Phase:** 3 (Application Tracker and Follow-ups)  
> **Status:** Proposed / In Execution  
> **Target Size:** M (Medium)  
> **Author:** Antigravity  
> **Timestamp:** 2026-09-20  

---

## 1. Goal

Implement the application lifecycle tracking, follow-up cadence, and funnel analytics specified in Section 8 of `ANTIGRAVITY_MASTER_INSTRUCTION.md`:
1. **Application Lifecycle Management:** Full state machine (`saved → applied → screening → interview → offer → accepted | rejected | withdrawn | ghosted`).
2. **One-Click Actions:** Instant "Applied" or "Save to Pipeline" directly from any job card or drawer.
3. **Append-Only Event Store:** Every status change, note, follow-up, or contact added appends an immutable record to `application_events`.
4. **Follow-Up Automation:** Intelligent scheduling of follow-up nudges (Applied → +7d, +14d, +30d ghosted suggestion; Interview → 24h thank-you prompt and decision tracking).
5. **Today View:** Actionable cockpit highlighting follow-ups due today, weekly application goal progress (10/week per D11), jobs at risk of closing, and alerts for tracked jobs closed by employers.
6. **Pipeline Kanban Board:** Visual workflow management across application stages with drag/click column transitions and quick contact/note edits.
7. **Funnel Analytics:** Comprehensive conversion rates by tier, source, role family, and channel, plus median response time.
8. **Lifecycle Guardrails:** Scans never overwrite application fields. Background closure of an actively tracked job triggers immediate alerts in the dashboard and Telegram digest.

---

## 2. Technical Design & Architecture

### 2.1 Schema & Storage (`lib/db/schema.ts`)
The SQLite tables `applications` and `application_events` (created in Phase 1) will be fully utilized and indexed:
* **`applications`**:
  * `id`: text primary key (UUID or `app_<job_id>`)
  * `jobId`: text foreign key references `jobs(id)`
  * `status`: text (`saved`, `applied`, `screening`, `interview`, `offer`, `accepted`, `rejected`, `withdrawn`, `ghosted`)
  * `channel`: text (`direct`, `referral`, `recruiter`, `other`)
  * `appliedAt`: ISO timestamp
  * `resumeVersionId`: text (links to Phase 4 kit)
  * `coverLetterId`: text
  * `contactsJson`: JSON array of `{ name, email, role, notes }`
  * `nextFollowUpAt`: ISO timestamp
  * `notes`: text
  * `outcomeReason`: text
  * `createdAt`, `updatedAt`: ISO timestamps
* **`application_events`**:
  * `id`: integer primary key auto-increment
  * `applicationId`: text foreign key references `applications(id)`
  * `eventType`: text (`status_change`, `applied`, `follow_up_sent`, `interview_scheduled`, `note_added`, `job_closed_by_employer`)
  * `createdAt`: ISO timestamp
  * `payloadJson`: JSON object with transition metadata

### 2.2 Application Service Layer (`lib/applications.ts`)
* `trackJob(jobId, status, details)`: Creates or updates an application record and appends to `application_events`.
* `recordApplicationEvent(applicationId, eventType, payload)`: Appends to `application_events` and updates `updatedAt`.
* `getFollowUpStatus(application)`: Computes whether follow-up is due, overdue, or upcoming based on standard cadence.
* `getTodayCockpit()`: Returns:
  - Weekly goal progress (start of current week Monday to now vs 10 goal).
  - Follow-ups due / overdue today.
  - Tracked jobs closed by employer (status `closed` in `jobs` but still active in `applications`).
  - Saved jobs at risk (>30 days since posting or high velocity).
  - New Tier A jobs discovered within the last 48 hours.
* `getFunnelInsights()`: Computes conversion rates, drop-off by stage, distribution by channel/tier/roleFamily, and median days to first response.

### 2.3 API Routes
* `app/api/applications/route.ts`:
  - `GET`: List applications with joined job details, filterable by status.
  - `POST`: Create or update application (e.g. one-click Apply or Save).
* `app/api/applications/[id]/route.ts`:
  - `PATCH`: Update status, notes, channel, contacts, follow-up date.
  - `DELETE`: Remove application record.
* `app/api/applications/[id]/events/route.ts`:
  - `GET`: Fetch timeline events for an application.
* `app/api/today/route.ts`:
  - `GET`: Serves data for the Today cockpit.
* `app/api/insights/route.ts`:
  - `GET`: Serves data for the funnel analytics.

### 2.4 UI Components (`app/page.tsx`)
* Tab bar in top navigation:
  - **Jobs (Triage):** Existing high-efficiency feed with Tier filtering, search, and one-click "Track / Applied" buttons.
  - **Today:** Daily operational dashboard with weekly goal progress bar, urgent follow-up action list, closed-job alerts, and risk warnings.
  - **Pipeline (Kanban):** Drag/click stages: `Saved`, `Applied`, `Screening`, `Interview`, `Offer`, `Archived/Closed`.
  - **Insights:** Funnel charts and conversion analytics.
* Interactive Application Modal / Drawer:
  - Quickly view/edit application channel, contacts, notes, and trigger status updates.

### 2.5 Lifecycle Protection & Alerts (`scripts/scheduler.ts`)
* Ensure `upsertCanonicalJobs` never touches `applications` or `application_events`.
* During scan closure detection (`consecutiveMissingScans >= 2`):
  - Check if closing job has an active application (`saved`, `applied`, `screening`, `interview`).
  - If yes, append an event `job_closed_by_employer` to `application_events`.
  - Include closed tracked jobs in the Telegram scan notification alert.

---

## 3. Task List

1. [x] **Data Snapshot:** Create timestamped backup of `data/`.
2. [ ] **Service Layer:** Implement `lib/applications.ts` (CRUD, event append, cadence calculator, today summary, funnel insights).
3. [ ] **API Endpoints:** Implement `/api/applications`, `/api/applications/[id]`, `/api/today`, and `/api/insights`.
4. [ ] **Scan Lifecycle Guardrail:** Update `scripts/scheduler.ts` to detect closed tracked jobs and send Telegram alerts.
5. [ ] **UI Implementation:** Add tabbed navigation to `app/page.tsx` with Today view, Kanban Pipeline, and Insights views.
6. [ ] **Card & Drawer Integration:** Add one-click "Applied" and "Track" buttons to job cards and the explain drawer.
7. [ ] **Testing:** Create comprehensive Vitest suite in `tests/phase3/applications.test.ts`.
8. [ ] **Verification:** Build, test, lint, and run end-to-end verification.

---

## 4. Test Plan

* **Unit Tests (`tests/phase3/applications.test.ts`):**
  * One-click "Applied" creates application and `applied` event.
  * State transitions append to `application_events` and update `applications.status`.
  * Cadence calculator correctly sets +7d, +14d for applied, and detects +30d ghosted.
  * Today summary calculates weekly applications goal correctly (e.g. 3 of 10 applied).
  * Closed tracked job detection generates alerts.
  * Funnel insights correctly aggregate conversion rates across stages.
* **Regression Tests:**
  * All Phase 0, 1, 2 test suites must continue passing.

---

## 5. Rollback Plan

If issues arise:
1. Applications are stored in isolated tables (`applications`, `application_events`) and do not alter `jobs` schema.
2. Roll back `app/page.tsx` and `scripts/scheduler.ts` via Git.
3. Restore database from `data-backup/2026-09-20T11-34-00-279Z` if needed.
