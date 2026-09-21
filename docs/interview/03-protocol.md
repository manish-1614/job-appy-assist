# WebSocket Wire Protocol Specification — Mock-Interview Proxy

**Version:** 1.0  
**Transport:** WebSocket (`ws://127.0.0.1:4001`)  
**Framing:** UTF-8 JSON text messages with Base64-encoded PCM payloads  
**Audio Formats:**
- **Candidate Microphone (Client → Server):** 16,000 Hz, 1-channel (mono), 16-bit signed linear PCM (`audio/pcm;rate=16000`).
- **Interviewer Voice (Server → Client):** 24,000 Hz, 1-channel (mono), 16-bit signed linear PCM (`audio/pcm;rate=24000`).

---

## 1. Overview & Connection Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant Client as Browser (Interview Room)
    participant Server as Local Proxy Server (:4001)
    participant Live as Gemini Live API

    Client->>Server: WebSocket Connect
    Client->>Server: session.start { sessionId, companyStyle, roundType, questionId }
    Server->>Server: Check monthly budget & active status
    Server->>Live: Open Gemini Live session with interviewer prompt
    Live-->>Server: Live session ready
    Server-->>Client: session.ready { sessionId, liveModel, budgetInfo }

    rect rgb(20, 30, 25)
    Note over Client, Live: Duplex Audio & Digest Loop
    Client->>Server: audio.chunk { pcm16Base64 }
    Server->>Live: sendRealtimeInput (audio/pcm;rate=16000)
    Client->>Server: artifact.update { kind: 'code'|'diagram', digest, content }
    Server->>Live: sendClientContent (Digest update)
    Live-->>Server: serverContent (audio/pcm;rate=24000 + transcription)
    Server-->>Client: audio.chunk { pcm24Base64 }
    Server-->>Client: transcript.entry { speaker, text, isFinal }
    Server-->>Client: interviewer.state { state: 'speaking' }
    end

    rect rgb(35, 20, 20)
    Note over Client, Server: Barge-In (Interruption)
    Client->>Server: candidate.speech_state { state: 'speaking' }
    Server-->>Client: interviewer.state { state: 'interrupted' }
    end

    Client->>Server: session.end { reason }
    Server->>Live: Close Live session
    Server-->>Client: session.ended { summary, costInr }
    Server->>Client: WebSocket Close
```

---

## 2. Client → Server Messages

### 2.1 `session.start`
Initiates an interview session.
```json
{
  "type": "session.start",
  "sessionId": "ses_1726918800000",
  "companyStyle": "google",
  "roundType": "system_design",
  "questionId": "sd-google-01",
  "candidateProfile": {
    "name": "Manish Kumar Prajapati",
    "yearsExperience": 8.5
  }
}
```

### 2.2 `audio.chunk`
Streams incoming microphone audio chunks (100–200ms per frame).
```json
{
  "type": "audio.chunk",
  "pcm16Base64": "//uQZAAAAAAAAAAAAAAAA...",
  "timestampMs": 1420
}
```

### 2.3 `artifact.update`
Transmits code or diagram digest when changed.
```json
{
  "type": "artifact.update",
  "kind": "diagram",
  "contentHash": "a3f8c12e...",
  "contentText": "COMPONENTS:\n- Client\n- API Gateway [Port: 443]\n- Kafka Broker [Topic: orders]\n\nCONNECTIONS:\n- Client -> API Gateway (HTTPS)\n- API Gateway -> Kafka Broker (Produce)",
  "timestampMs": 5200
}
```

### 2.4 `candidate.speech_state`
Notifies candidate voice activity (for instant local barge-in coordination).
```json
{
  "type": "candidate.speech_state",
  "state": "speaking"
}
```
*Possible states:* `"speaking"`, `"silent"`, `"interrupted"`.

### 2.5 `session.end`
Requests session termination and finalization.
```json
{
  "type": "session.end",
  "reason": "user_completed"
}
```

---

## 3. Server → Client Messages

### 3.1 `session.ready`
Emitted when the Gemini Live session is established and ready for audio.
```json
{
  "type": "session.ready",
  "sessionId": "ses_1726918800000",
  "liveModel": "gemini-2.5-flash",
  "budgetInfo": {
    "monthlyCostInr": 1240.50,
    "budgetInr": 15000,
    "budgetRemainingInr": 13759.50,
    "percentUsed": 8.27,
    "warningLevel": "none"
  }
}
```

### 3.2 `audio.chunk`
Streams outgoing synthesized interviewer speech (24,000 Hz linear PCM).
```json
{
  "type": "audio.chunk",
  "pcm24Base64": "//uQZBBBBBBBBBBBB...",
  "turnId": 3
}
```

### 3.3 `transcript.entry`
Real-time spoken captions for both candidate and interviewer.
```json
{
  "type": "transcript.entry",
  "speaker": "interviewer",
  "text": "Let's begin by discussing how your API gateway handles authentication and rate limiting.",
  "isFinal": true,
  "turnId": 3,
  "timestampMs": 8450
}
```

### 3.4 `interviewer.state`
Updates the interviewer's state to control UI indicators and the animated robot avatar.
```json
{
  "type": "interviewer.state",
  "state": "speaking",
  "rms": 0.42
}
```
*Possible states:* `"idle"`, `"listening"`, `"thinking"`, `"speaking"`, `"interrupted"`.

### 3.5 `observer.cue`
Optional visual cue informing the client that an observer probe was injected.
```json
{
  "type": "observer.cue",
  "cueType": "traffic_surge_probe",
  "message": "Observer injected probe on traffic spike handling"
}
```

### 3.6 `usage.update`
Periodic telemetry reporting token usage and cumulative session/monthly spend.
```json
{
  "type": "usage.update",
  "usage": {
    "inputAudioTokens": 4500,
    "outputAudioTokens": 3200,
    "textIn": 1500,
    "textOut": 400,
    "costUsd": 0.054,
    "costInr": 4.59,
    "monthlyCostInr": 1245.09,
    "budgetInr": 15000,
    "percentUsed": 8.30
  }
}
```

### 3.7 `error`
Reports an error (recoverable or fatal).
```json
{
  "type": "error",
  "code": "BUDGET_EXCEEDED",
  "message": "Monthly interview budget of INR 15,000 has been reached.",
  "fatal": true
}
```

---

## 4. Error Codes

| Code | Severity | Description |
|---|---|---|
| `BUDGET_EXCEEDED` | Fatal | Monthly expenditure has reached or exceeded INR 15,000. |
| `SESSION_MAX_DURATION` | Fatal | Session exceeded `INTERVIEW_SESSION_MAX_MINUTES` (60m). |
| `LIVE_CONNECTION_FAILED` | Fatal | Failed to establish WebSocket connection with Google Gemini Live API. |
| `AUDIO_DECODE_ERROR` | Non-fatal | Malformed base64 or corrupt PCM frame received. |
| `UPSTREAM_DROPPED` | Recoverable | Upstream Gemini Live dropped; attempting resumption handle reconnect. |
| `INVALID_MESSAGE` | Non-fatal | Message payload does not conform to protocol schema. |
