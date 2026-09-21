# Google Senior Software Engineer (L5/L6) Interview Loop Template

> **CRITICAL NOTICE:** Every claim about company processes in this document is an **[ASSUMPTION — VERIFY AGAINST CURRENT PUBLIC SOURCES & RECRUITER BRIEFING]**. Google's interview guidelines, on-site vs virtual policies, and tooling vary by location and year.

---

## 1. Ground Rules & Official Policy Notes

- **Zero AI Assistance:** Google strictly prohibits any generative AI assistance (LLMs, Copilot, ChatGPT, IDE auto-complete) during live interviews. The candidate must write code and explain designs entirely by human cognition.
- **Delivery Mode [ASSUMPTION — verify]:** In-person whiteboard/laptop interviews have resumed at many global offices (e.g. Tokyo, Seoul, Bangalore, Bay Area), while virtual video loops via Google Meet & Google Docs/internal code editor remain common for remote or international candidates. Confirm mode with recruiter.
- **Pilots [ASSUMPTION — verify]:** A code-comprehension round (reading and explaining a large unfamiliar codebase) is reported to be piloted for select junior/mid roles in 2026; for senior/staff (L5/L6), the standard loop typically remains Coding + System Design + Googleyness. Confirm exact slate with recruiter.

---

## 2. Standard Senior (L5/L6) Loop Breakdown

A standard Google Senior loop consists of 5 rounds (45 minutes each):

| Round | Focus | Tool | Evaluation Pillars |
|---|---|---|---|
| **Round 1: Coding (DSA C++)** | Advanced Data Structures & Algorithms | Plain text editor / Google Docs | Problem solving, optimal complexity, bug-free C++ code, edge case testing |
| **Round 2: Coding (DSA C++)** | Complex Algorithms / Graphs / DP | Plain text editor / Google Docs | Pattern recognition, mathematical rigor, clean modular design |
| **Round 3: System Design** | Large-Scale Distributed Architecture | Excalidraw / Digital Whiteboard | Requirements, capacity sizing, component decoupling, spike handling, failure recovery |
| **Round 4: System Design** | Domain Deep-Dive / End-to-End | Excalidraw / Digital Whiteboard | Data consistency, distributed caching, observability, latency trade-offs |
| **Round 5: Googleyness & Leadership** | Behavioral & Situational Leadership | Voice / Video dialogue | Navigating ambiguity, leading without authority, blameless post-mortems, inclusive culture |

---

## 3. 45-Minute Session Cadence (Mock Simulator Schedule)

- **00:00 – 03:00:** Brief greeting & interviewer states the problem statement.
- **03:00 – 08:00:** Candidate drives problem understanding, clarifying questions, input constraints, and test scenarios.
- **08:00 – 15:00:** High-level approach discussion. Candidate outlines brute force, deduces optimal algorithm, and states tight time/space complexity before coding.
- **15:00 – 35:00:** Active coding (Monaco C++) or architectural sketch (Excalidraw). Candidate thinks aloud; interviewer probes on edge cases or drifts.
- **35:00 – 40:00:** Manual dry-run of test cases, edge case verification (empty, overflow, duplicate).
- **40:00 – 45:00:** Wrap up and candidate questions.

---

## 4. What to Verify with the Recruiter
- [ ] Will the interviews be conducted via Google Meet + Google Docs, or on-site in Tokyo/Seoul/Bangalore?
- [ ] Is the coding platform pure Google Docs (no syntax highlighting or auto-indent), or a lightweight web IDE?
- [ ] What is the exact distribution between System Design and Coding rounds for this specific role/level?
- [ ] Is there any domain-specific round (e.g. telecom microservices, machine learning infrastructure)?
