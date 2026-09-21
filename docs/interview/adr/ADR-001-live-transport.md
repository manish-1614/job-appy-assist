# ADR-001: Live Transport Architecture — Local Server-Side WebSocket Proxy

## Status
Accepted

## Context
The Mock-Interview module requires real-time, low-latency, bidirectional audio streaming between the candidate's browser and Google Gemini's Multimodal Live API.

There are two primary architectural approaches:
1. **Browser-Direct with Ephemeral Tokens:** The frontend obtains an ephemeral session token from a Next.js route handler and establishes a direct WebSocket connection from the browser to `wss://generativelanguage.googleapis.com/...`.
2. **Local Server-Side WebSocket Proxy:** The frontend connects via WebSocket (`ws://127.0.0.1:4001`) to a dedicated local Node.js proxy process (`pnpm interview:server`). This proxy maintains the upstream Live session to Gemini using `@google/genai` (or raw WSS).

Next.js 14 Route Handlers run on Node request-response abstractions and cannot hold long-lived, bidirectional WebSocket sessions.

## Decision
We choose **Option 2: Local Server-Side WebSocket Proxy (`pnpm interview:server`)**.

### Key Rationale:
1. **Internal Observer Injection:** The background Observer service runs server-side and must inject steering guidance (`[INTERNAL-OBSERVER]`) into the ongoing Live session context. In a browser-direct architecture, the browser would have to arbitrate observer injection, exposing internal prompts, hidden reference approaches, and grading guidelines to client-side inspect tools.
2. **Deterministic Logging & Auditing:** The proxy receives both candidate and interviewer turns, audio transcript chunks, and usage metadata directly. It can write turns and events straight to the local SQLite database without relying on client HTTP posts.
3. **Secret Isolation:** The master paid-tier `GEMINI_API_KEY` never leaves the local proxy process. No ephemeral token negotiation or token expiry management is required.
4. **Resilience & Resumption:** Network hiccups between browser and local proxy are trivial (loopback `127.0.0.1`). If Gemini issues a `GoAway` or connection drop upstream, the server proxy handles session resumption and context re-hydration transparently without tearing down the browser audio pipeline.

## Process Layout
```
[ Browser UI (Next.js :3000) ]
        |
        | AudioWorklet PCM (16kHz in / 24kHz out) + JSON state
        v
[ Local WS Proxy (:4001 via `pnpm interview:server`) ]
   |                  |                       ^
   | Reads/Writes     | Real-time Bidi WSS    | Evaluates snapshots & injects probes
   v                  v                       |
[ SQLite DB ]     [ Gemini Live API ]     [ Observer Service (Gemini Flash) ]
```

## Consequences
- Requires running two processes during development/usage: `pnpm dev` and `pnpm interview:server` (or an orchestrated script `pnpm interview:all`).
- Clear separation of concerns: Next.js handles UI/static assets/REST endpoints; the WebSocket proxy handles real-time audio and LLM session coordination.
- References: Google Gemini Live API Guide ([https://ai.google.dev/gemini-api/docs/live-guide](https://ai.google.dev/gemini-api/docs/live-guide)).
