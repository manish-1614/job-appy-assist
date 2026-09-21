# JobAppy Assist: Intelligent Career Assistant & Mock-Interview Simulator

JobAppy Assist is a local-only, privacy-respecting career automation platform built with Next.js 14, TypeScript, better-sqlite3 (SQLite via Drizzle), and Google Gemini models.

---

## 🌟 Key Features

### 1. Job Discovery, Scoring & Application Kit
- **Deterministic Pipeline:** Scrapes, deduplicates, and evaluates job openings against a hard-gated candidate profile (INR 25L floor, remote worldwide / India / Tokyo-Seoul relocation).
- **Zero-Fabrication Application Kit:** Tailors resumes and cover letters with verifiable factual provenance mapped directly to achievement bank entries.

### 2. "Evaluate Any Job Opening URL" (`/evaluate`)
- Dedicated sidebar navigation item and route to evaluate arbitrary job openings from Greenhouse, Ashby, Lever, or general web pages.
- Computes deterministic fit scores, extracted tech stacks, and location eligibility without adding unwanted jobs to your tracking queue.

### 3. Real-Time Mock-Interview Voice Simulator (`/interview`)
- **Duplex Gemini Live Voice:** Real-time speech streaming (16kHz in, 24kHz out) with sub-second turnaround and native candidate barge-in support.
- **Interviewer Personas:** Calibrated Google-style (rigorous, scale-focused, zero unearned praise, STAR metrics) and Toptal-style (fast-paced, communication, edge-case probing).
- **Multimodal Visual Context:**
  - **Excalidraw Canvas:** Ingests spatial architecture blocks, databases, and connections as structured semantic topology digests for System Design rounds.
  - **Monaco C++ Editor:** Ingests live C++ code snapshots with distraction-free interview settings (autocomplete/snippets disabled).
- **Adversarial Observer Service:** Background evaluator monitoring candidate design against critical bottlenecks (50x spikes, outbox patterns, queue backpressure, race conditions) and injecting spoken probes through a deterministic policy engine (silence check >=4s, cooldown >=90s, frequency cap).
- **Post-Session Bar Raiser Grader:** Post-interview rubric evaluations (1.0 to 4.0 scale) enforcing the Zero-Fabrication rule: every score must cite verbatim transcript quotes or code snippets.
- **Cost Metering & Hard Budget Cap:** Real-time token and audio telemetry enforcing a monthly ceiling of INR 15,000 (ADR-004) with progressive warning triggers.

---

## 🚀 Quick Start

### 1. Installation
```bash
# Install dependencies using pnpm
pnpm install
```

### 2. Environment Configuration
Create or edit `.env.local` in the project root:
```env
# Gemini API Key (paid tier, server-side only)
GEMINI_API_KEY=your_gemini_api_key_here

# Models (ADR-003)
INTERVIEW_LIVE_MODEL=gemini-2.5-flash
INTERVIEW_OBSERVER_MODEL=gemini-2.5-flash-lite
INTERVIEW_GRADER_MODEL=gemini-2.5-pro

# Monthly Budget in INR (ADR-004)
INTERVIEW_MONTHLY_BUDGET_INR=15000
INTERVIEW_SESSION_MAX_MINUTES=60
INTERVIEW_FX_INR_PER_USD=85.00
```

### 3. Launching Services
Run the web application and the WebSocket proxy server side by side:

**Terminal 1 — Next.js Web App:**
```bash
pnpm dev
# Bound to http://127.0.0.1:3000
```

**Terminal 2 — Mock-Interview WebSocket Proxy:**
```bash
pnpm interview:server
# Bound to ws://127.0.0.1:4001
```

### 4. Verification & Testing
```bash
# Run standalone WebSocket proxy smoke test
pnpm interview:smoke

# Run full unit and calibration test suite (vitest)
pnpm test

# Run ESLint check
pnpm lint

# Production build check
pnpm build
```

---

## 📁 Architecture & Documentation

- `docs/interview/00-recon.md`: Initial audit findings and architecture baseline.
- `docs/interview/01-prd.md`: Product Requirements Document and user stories.
- `docs/interview/02-hld.md`: High-Level Design and Mermaid system sequence flows.
- `docs/interview/03-protocol.md`: Wire protocol specification for client-server WebSockets.
- `docs/interview/PROGRESS.md`: Phase-by-phase execution and verification log.
- `docs/interview/adr/`: Architectural Decision Records (ADR-001 through ADR-004).
- `docs/interview/pack/`: Question banks, machine-readable rubrics, hint ladders, and calibration datasets.
