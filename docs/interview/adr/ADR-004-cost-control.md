# ADR-004: Cost Control, Token Metering & Budget Enforcement

## Status
Accepted

## Context
Voice streaming with Multimodal Live models carries higher per-token costs than text-only models due to continuous bidirectional audio processing. To prevent accidental overspend during long mock sessions, strict budget controls, real-time usage metering, and progressive warning thresholds are mandatory.

## Decision
We implement a **multi-tiered cost control and metering engine** in the local interview server and database.

### 1. Configuration & FX Rates
All rates and limits are stored in central configuration (`lib/interview/config.ts`) and overridable via environment variables:
- `INTERVIEW_MONTHLY_BUDGET_INR`: Default `15000` (INR 15,000 / month).
- `INTERVIEW_SESSION_MAX_MINUTES`: Default `60` (hard session cap).
- `INTERVIEW_FX_INR_PER_USD`: Default `85.00` (reviewed periodically).

### 2. Pricing Matrix (Gemini Live & Multimodal Models)
Pricing defaults (USD per 1,000,000 tokens):
- **Live Audio Input:** `$3.00` / 1M tokens
- **Live Audio Output:** `$12.00` / 1M tokens
- **Text Input / Context Tokens:** `$0.75` / 1M tokens
- **Text Output Tokens:** `$4.50` / 1M tokens
- **Observer (Flash-Lite / Flash):** Input `$0.075` / 1M, Output `$0.30` / 1M
- **Grader (Pro):** Input `$1.25` / 1M, Output `$5.00` / 1M

*Note: In the Live API, 1 second of audio is roughly equivalent to ~25–32 audio tokens. A 30-minute voice interview produces ~45k–60k audio tokens each way plus context tokens, typically costing between $0.80 and $1.50 per session.*

### 3. Usage Metering & Event Tracking
- The server captures `usageMetadata` from each Live turn and observer call:
  - `promptTokenCount` (split into audio and text where available)
  - `candidatesTokenCount`
  - `totalTokenCount`
- The proxy computes incremental USD and INR cost, accumulating into `interview_usage` and `interview_sessions`.

### 4. Safety Gates & Enforcement Triggers
1. **Pre-Session Budget Check:** Before a session starts, the server queries the sum of `cost_inr_est` for all sessions in the current calendar month. If monthly spend >= 100% of budget, session creation is blocked.
2. **Warning Thresholds:**
   - **50% Monthly Budget Reached:** Informational banner in UI setup and room footer.
   - **80% Monthly Budget Reached:** Amber alert; UI requires explicit confirmation to proceed.
   - **100% Monthly Budget Reached:** Hard block; new sessions cannot be started.
3. **Per-Session Safeguards:**
   - **Duration Limit:** If session reaches `INTERVIEW_SESSION_MAX_MINUTES` (e.g. 60m), the interviewer initiates a clean spoken wrap-up and terminates the connection.
   - **Emergency Kill Switch:** A UI "End Session" button and a server CLI trigger immediately close upstream sockets, write final usage to SQLite, and release resources.

## Consequences
- Total predictability in AI Studio / Gemini API billing.
- Clear real-time visibility into usage costs on both the setup screen and completed session reports.
