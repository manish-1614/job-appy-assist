# Manual Mock-Interview Execution Plan (Google AI Studio Live)

**Goal:** Execute 5 realistic manual practice sessions in Google AI Studio's Live playground using the interview pack assets before building the full automated application runtime. This validates model latency, probing quality, voice cadence, and rubric accuracy.

---

## 1. Prerequisites & AI Studio Setup

1. Open [Google AI Studio](https://aistudio.google.com/) and navigate to the **Live Mode** / Multimodal Playground.
2. Select a Live-enabled model (e.g. `gemini-3.8-live` or `gemini-3.8-live-extended-thinking`).
3. Set the **System Instructions** by copying the contents of [`docs/interview/pack/prompts/interviewer.system.md`](prompts/interviewer.system.md), substituting `{COMPANY_STYLE}`, `{ROUND_TYPE}`, `{QUESTION}`, and `{TIME_LIMIT}` for each session.
4. Voice Selection: Choose a neutral, professional English voice (e.g. "Puck" or "Aoede").
5. Whiteboard / Code Context Sharing:
   - Since AI Studio playground does not have the custom websocket digest channel, share your screen (with Excalidraw or Monaco C++ editor visible) or paste your diagram summary / code snippet into the chat box when ready for review.
6. Recording: Record your audio or take notes during the session to fill in [`docs/interview/pack/templates/session-log.md`](templates/session-log.md).

---

## 2. The 5 Calibration Sessions

### Session 1: System Design — Flash-Sale Checkout [Spike Handling Focus]
- **Company Style:** Google
- **Round Type:** System Design (45 minutes)
- **Question ID:** `sys_flash_sale`
- **Model Variant to Test:** `gemini-3.8-live`
- **Test Focus:**
  - Can the interviewer detect when you fail to mention the 50x flash surge?
  - Does it probe on autoscaling lag (3–5 min)?
  - Does it ask about database connection pool exhaustion and Redis Lua atomic counters?

### Session 2: System Design — Webhook Delivery Platform [Decoupling & Idempotency Focus]
- **Company Style:** Google
- **Round Type:** System Design (45 minutes)
- **Question ID:** `sys_webhook_platform`
- **Model Variant to Test:** `gemini-3.8-live-extended-thinking`
- **Test Focus:**
  - Compare reasoning depth against Session 1 (`3.8-live` vs `3.8-live-extended-thinking`).
  - Does the extended thinking model ask deeper follow-ups on consumer idempotency and Transactional Outbox?
  - Does it challenge slow customer endpoints and worker thread starvation?

### Session 3: Advanced DSA in C++ — Constrained Shortest Path or Monotonic Structure
- **Company Style:** Google
- **Round Type:** Advanced DSA in C++ (45 minutes)
- **Question ID:** `dsa_constrained_shortest_path` (or `dsa_sliding_window_max`)
- **Model Variant to Test:** `gemini-3.8-live`
- **Test Focus:**
  - Enforcing the 5-rung hint ladder: does it stay at Rung 0 and Rung 1 before giving away techniques?
  - Does it demand time/space Big-O before coding?
  - Does it catch C++ iterator invalidation, pass-by-value, or integer overflow?

### Session 4: Google-Style Behavioral — Googleyness & Leadership
- **Company Style:** Google
- **Round Type:** Behavioral (45 minutes)
- **Question ID:** Selected from `behavioral_google` (Ambiguity `beh_google_ambiguity` + Conflict `beh_google_conflict`)
- **Model Variant to Test:** `gemini-3.8-live`
- **Test Focus:**
  - Does the interviewer reject vague generalities and ask for specific metrics?
  - Does it challenge you on what *you* personally did versus what the *team* did?
  - Does it probe for humble, blameless self-reflection on mistakes?

### Session 5: Toptal-Style Communication & Live-Coding Screen
- **Company Style:** Toptal
- **Round Type:** Communication Screen & Live Coding (60 minutes)
- **Question ID:** `comm_explain_distributed_lock` + `dsa_lru_cache`
- **Model Variant to Test:** `gemini-3.8-live`
- **Test Focus:**
  - Tests 2-minute concise executive explanation of distributed locking.
  - Tests live pair-programming speed, memory leaks, and C++ STL correctness on LRU Cache.

---

## 3. Model Comparison Matrix (Fill During Sessions 1 & 2)

| Metric | `gemini-3.8-live` (Session 1) | `gemini-3.8-live-extended-thinking` (Session 2) |
|---|---|---|
| First-Audio-Token Latency (approx) | | |
| Conversational Naturalness (1-5) | | |
| Probing Sharpness (did it catch omissions?) | | |
| Tendency to Hallucinate / Over-Praise | | |
| Recommended for Real-Time Voice Proxy | | |

---

## 4. Human Mock Benchmark Instruction

> **MANDATORY CALIBRATION GATEWAY:**  
> Immediately following the completion of these 5 AI Studio sessions, you must schedule **two (2) paid human mock interviews** with verified Staff/Principal engineers on a platform such as Interviewing.io, Prepfully, or Exponent (one System Design and one DSA C++).  
>
> 1. Record your scores and verbatim feedback from the human interviewers.
> 2. Feed the exact same problem and transcript into our AI Grader (`prompts/grader.system.md`).
> 3. Compare the AI Grader's scores against the human staff interviewers' scores.
> 4. Ensure the AI Grader does not score more than 0.5 points higher than the human bar raiser (anti-inflation guarantee).
