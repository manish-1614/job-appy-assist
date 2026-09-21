# ADR-003: Model Registry & Gemini Live Capability Verification

## Status
Accepted

## Context
The interview module orchestrates three distinct LLM roles:
1. **Live Voice Interviewer:** Interacts in real time via duplex audio, asks questions, listens to answers, probes vagueness, guides with hint rungs, and reacts to internal observer injections. Requires native low-latency audio support.
2. **Observer Service:** Analyzes diagram digests, code snapshots, and recent transcript turns in the background every 5–10s. Requires low latency, low token cost, and structured JSON output.
3. **Post-Session Grader:** Analyzes the complete session transcript, code, and diagram after the interview ends to produce rubric scores with exact evidence quotes. Requires strong reasoning, calibration stability, and zero hallucinations.

Hardcoding model IDs into application logic is prohibited. All model identifiers must be env-configurable through a central registry.

## Decision
We define an extensible model registry in code (`lib/interview/models.ts`) driven by environment variables with fallback defaults.

### Model Roles & Registry Configuration:
| Role | Environment Variable | Default Value | Fallback Candidates | Purpose |
|---|---|---|---|---|
| **Live Interviewer** | `INTERVIEW_LIVE_MODEL` | `gemini-3.8-live` | `gemini-3.8-live-extended-thinking`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-native-audio-preview` | Real-time duplex voice streaming, interruptibility, hint ladder adherence |
| **Observer** | `INTERVIEW_OBSERVER_MODEL` | `gemini-2.5-flash-lite` | `gemini-2.5-flash`, `gemini-3.1-flash-lite` | High-frequency background state tracking & drift detection |
| **Grader** | `INTERVIEW_GRADER_MODEL` | `gemini-2.5-pro` | `gemini-2.5-flash`, `gemini-3.1-pro-preview` | Rigorous evidence-backed rubric grading & feedback generation |

### Official Live API Capability Verification Results:
Based on Google's Multimodal Live API specifications ([https://ai.google.dev/gemini-api/docs/live-guide](https://ai.google.dev/gemini-api/docs/live-guide)):
1. **Audio Transcription Both Directions:**
   - **Supported.** Configuring `output_audio_transcription: {}` streams incremental text tokens for the model's spoken response via `serverContent.outputTranscription.text`.
   - Incoming candidate speech transcription is provided in real-time as `serverContent.inputTranscription.text`, enabling instant live captions and reliable transcript assembly.
2. **Context Window Compression & Sliding Window:**
   - **Supported.** The Live API supports server-side context window management. Sessions exceeding window thresholds automatically slide or compress older conversation turns, preventing memory/token runaway during 30–60 minute sessions.
   - Re-injection hook: When a compression event occurs, the proxy re-injects a compact reminder of the active question and rubric anchors.
3. **Session Resumption & GoAway Handling:**
   - **Supported.** The Live API provides session resumption tokens (`resumeSessionHandle`). If the connection drops or the server emits a disconnect/`GoAway` notification, the proxy initiates a reconnect handshake presenting the token, seamlessly restoring conversational history.
4. **Tool / Function Calling:**
   - **Supported.** The Live API supports standard `functionDeclarations`. The model can invoke client or server tools asynchronously during a voice session.

## Consequences
- Changing or upgrading models requires only editing `.env.local` without touching logic.
- Cost and performance trade-offs can be benchmarked directly across model versions (e.g. comparing `gemini-3.8-live` vs `gemini-3.8-live-extended-thinking` during Phase 2 manual sessions).
