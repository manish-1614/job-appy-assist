# Product Requirements Document (PRD) — Mock-Interview Voice Module

**Date:** 2026-09-21  
**Project:** JobAppy Assist — Interview Intelligence & Real-Time Mock Simulator  
**Version:** 1.0  
**Target User:** Senior / Staff Distributed Systems & AI Engineer (Manish Kumar Prajapati)

---

## 1. Product Vision & Goals

**Vision:** Bridge the gap between job discovery and landing top-tier senior roles (e.g., Toptal, Google, global remote tech leaders) by providing an ultra-realistic, low-latency, multimodal AI voice mock interviewer.

### Primary Objectives:
1. **Realistic Voice Pressure:** Low-latency conversational voice interactions using Gemini Live API where the interviewer behaves as a neutral, rigorous senior interviewer rather than an agreeable chatbot.
2. **Multimodal Context Synchronization:** The interviewer sees the candidate's real-time architecture diagrams (Excalidraw) and C++ code (Monaco) translated into compact semantic text digests without screen recording or video streaming overhead.
3. **Active Drift & Stall Probing (Observer):** When the candidate avoids critical bottlenecks (e.g., traffic surges, decoupled event pipelines, race conditions) or stalls, the observer instructs the interviewer to naturally interject by voice.
4. **Adversarial, Evidence-Backed Grading:** Comprehensive rubrics (1–4 scale) where every grade is justified by verbatim transcript quotes and timestamped events, preventing score inflation.
5. **Strict Local Cost & Privacy Control:** Single-user local execution, server-side secret management, token metering, and strict monthly budget enforcement (INR 15,000 cap).

---

## 2. Non-Goals (Strictly Out of Scope)

- **Video or Screen-Share Streaming:** No camera feeds or raw pixel video streams into the LLM. Diagramming and coding are ingested solely via structured text digests.
- **Multi-Tenant / Public Cloud SaaS:** No multi-user authentication, billing platforms, or hosted cloud deployments. Local-only single-user tool.
- **Automated Resume Tailoring within Voice Flow:** Application Kit tailoring remains in its existing dedicated module; the interview module focuses strictly on verbal and technical simulation.
- **Mobile Application:** Optimized strictly for desktop browser environments (Chrome/Edge on Windows 11 with standard mic/headphones).

---

## 3. User Persona & User Stories

**Persona:** Manish Kumar Prajapati — 8.5+ years experience, Senior/Staff Backend & Distributed Systems Engineer, specializing in high-throughput CRM microservices, Kafka event pipelines, and AI agent orchestration.

### Key User Stories:
- **US-1: Realistic Simulation Setup:** As a candidate, I want to select my target company style (Toptal or Google), round type (System Design, Advanced DSA, Behavioral, Communication), and specific question from a curated bank so that I can practice targeted weaknesses.
- **US-2: Natural Spoken Dialogue:** As a candidate, I want to talk back and forth naturally with sub-second response times, hearing spoken English responses and interrupting the interviewer when necessary ("barge-in").
- **US-3: Diagram & Code Ingestion:** As a candidate, I want to sketch architecture blocks on Excalidraw or write C++ in Monaco, and have the interviewer seamlessly understand my components and logic without having to read my entire screen.
- **US-4: Spoken Probing on Drift:** As a candidate, when I spend too long on trivial details or ignore critical requirements (like a flash-sale 50x spike or event ordering), I want the interviewer to interject with a targeted, probing question.
- **US-5: Transparent, Actionable Report:** As a candidate, after ending a session, I want a detailed breakdown of my performance against standard rubrics, citing exact quotes from the transcript and recommending specific follow-up drills.

---

## 4. Session Types & Focus Areas

| Session Type | Company Styles | Primary Tool | Key Focus & Evaluation Criteria |
|---|---|---|---|
| **System Design** | Google, Toptal | Excalidraw (Diagram) | Traffic-spike handling (backpressure, load shedding, caching/thundering herd, circuit breakers); Decoupling (outbox, idempotency, sagas, retries/DLQ); Consistency vs Availability tradeoffs; API & Data schema; Observability & failure modes. |
| **Advanced DSA (C++)** | Google | Monaco Editor (C++) | Clarification & constraints; Pattern recognition; Brute force to optimal; Time & space complexity analysis; Edge cases; Dry run on test case; C++ STL idioms & memory safety; Tracked hint ladder (H0–H4). |
| **Behavioral** | Google (Googleyness & Leadership) | Voice Only | Scope, ambiguity, conflict resolution, influence without authority, measurable impact (STAR framework), self-reflection and growth mindset. |
| **Communication Screen** | Toptal Screen | Voice Only | Structured problem formulation, conciseness (no rambling), clarity of explanation, English fluency, professional presence, handling pushback. |
| **Solutions / FDE Scenario** | Toptal, Forward Deployed | Excalidraw / Voice | Customer requirement discovery, technical translation, trade-off presentation to non-technical stakeholders, delivery risk mitigation. |

---

## 5. Success Metrics

1. **Voice Turnaround Latency:** Time-to-first-audio-token under 1.2 seconds for natural conversation flow.
2. **Probe Relevance:** At least 80% of observer-triggered interjections address genuine omissions or drift in the candidate's design.
3. **Zero False Interjections:** Zero interruptions triggered while the candidate is actively speaking.
4. **Grader Discrimination:** Clear separation between strong and weak calibration answers (minimum 1.0 point difference on a 4.0 rubric scale).
5. **Cost Compliance:** 100% adherence to the monthly INR 15,000 budget cap with automated warning notifications.
