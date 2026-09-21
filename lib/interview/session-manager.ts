import { WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { sqlite } from '../db';
import { INTERVIEW_CONFIG } from './config';
import {
  ClientMessage,
  ServerMessage,
  serializeServerMessage,
  SessionUsageInfo,
} from './protocol';
import { checkBudgetGuard, recordSessionUsage } from './cost-meter';
import { compileInterviewerPrompt, QuestionDefinition } from './prompts';

export class InterviewSessionManager {
  private clientWs: WebSocket;
  private sessionId: string | null = null;
  private liveSession: any = null;
  private liveAiClient: GoogleGenAI | null = null;
  private startTimeMs: number = Date.now();
  private turnSeq: number = 0;
  private currentInterviewerText: string = '';
  private currentCandidateText: string = '';
  private isMockMode: boolean = false;
  private activeQuestion: QuestionDefinition | null = null;

  constructor(clientWs: WebSocket, isMockMode = false) {
    this.clientWs = clientWs;
    this.isMockMode = isMockMode || process.env.MOCK_LIVE === 'true';

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && !this.isMockMode) {
      this.liveAiClient = new GoogleGenAI({ apiKey });
    } else {
      this.isMockMode = true;
    }
  }

  public async handleMessage(msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'session.start':
        await this.handleSessionStart(msg);
        break;

      case 'audio.chunk':
        await this.handleAudioChunk(msg);
        break;

      case 'artifact.update':
        await this.handleArtifactUpdate(msg);
        break;

      case 'candidate.speech_state':
        this.handleCandidateSpeechState(msg);
        break;

      case 'session.end':
        await this.handleSessionEnd(msg.reason || 'user_ended');
        break;
    }
  }

  private send(msg: ServerMessage): void {
    if (this.clientWs.readyState === WebSocket.OPEN) {
      this.clientWs.send(serializeServerMessage(msg));
    }
  }

  private async handleSessionStart(msg: Extract<ClientMessage, { type: 'session.start' }>): Promise<void> {
    this.sessionId = msg.sessionId;
    this.startTimeMs = Date.now();

    // 1. Budget Guard Check (ADR-004)
    const budgetCheck = checkBudgetGuard();
    if (!budgetCheck.allowed) {
      this.send({
        type: 'error',
        code: 'BUDGET_EXCEEDED',
        message: `Monthly budget of INR ${budgetCheck.budgetInr} has been reached. Sessions are blocked.`,
        fatal: true,
      });
      this.clientWs.close(1008, 'Budget exceeded');
      return;
    }

    // 2. Prepare System Prompt & Question
    let compiled: { systemPrompt: string; question: QuestionDefinition };
    try {
      compiled = compileInterviewerPrompt({
        companyStyle: msg.companyStyle,
        roundType: msg.roundType,
        questionId: msg.questionId,
        timeLimitMinutes: INTERVIEW_CONFIG.budget.sessionMaxMinutes,
      });
      this.activeQuestion = compiled.question;
    } catch (err: any) {
      this.send({
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: err.message || 'Failed to compile interview prompt',
        fatal: true,
      });
      return;
    }

    // 3. Upsert session record in SQLite
    const nowIso = new Date().toISOString();
    sqlite
      .prepare(
        `INSERT INTO interview_sessions (
           id, started_at, company_style, round_type, question_id, live_model, status, config_json, cost_usd_est, cost_inr_est
         ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 0, 0)
         ON CONFLICT(id) DO UPDATE SET
           status = 'active', started_at = ?`
      )
      .run(
        this.sessionId,
        nowIso,
        msg.companyStyle,
        msg.roundType,
        msg.questionId,
        INTERVIEW_CONFIG.models.live,
        JSON.stringify({ candidateProfile: msg.candidateProfile }),
        nowIso
      );

    // 4. Initialize Live Session or Mock
    if (this.isMockMode || !this.liveAiClient) {
      this.initializeMockSession(compiled.question);
    } else {
      try {
        await this.initializeLiveSession(compiled.systemPrompt);
      } catch (err: any) {
        console.warn('Gemini Live connection failed, falling back to mock mode:', err.message);
        this.isMockMode = true;
        this.initializeMockSession(compiled.question);
      }
    }

    // 5. Emit session.ready
    this.send({
      type: 'session.ready',
      sessionId: this.sessionId,
      liveModel: this.isMockMode ? 'mock-live-simulator' : INTERVIEW_CONFIG.models.live,
      budgetInfo: budgetCheck,
    });
  }

  private async initializeLiveSession(systemPrompt: string): Promise<void> {
    if (!this.liveAiClient) return;

    this.liveSession = await this.liveAiClient.live.connect({
      model: INTERVIEW_CONFIG.models.live,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede',
            },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.recordEvent('live_connected', { model: INTERVIEW_CONFIG.models.live });
        },
        onmessage: (e: any) => {
          this.handleLiveServerMessage(e);
        },
        onerror: (e: any) => {
          console.error('Gemini Live error:', e);
          this.recordEvent('error', { error: String(e) });
        },
        onclose: () => {
          this.recordEvent('live_closed', {});
        },
      },
    });
  }

  private initializeMockSession(question: QuestionDefinition): void {
    // In mock mode, generate initial welcome speech and transcription after brief delay
    setTimeout(() => {
      if (!this.sessionId) return;
      const initialText = `Hello Manish. Today we will work through: ${question.interviewerPrompt}. How would you like to start?`;
      this.send({
        type: 'transcript.entry',
        speaker: 'interviewer',
        text: initialText,
        isFinal: true,
        timestampMs: Date.now() - this.startTimeMs,
      });

      this.recordTurn('interviewer', initialText, 'audio_transcript');

      // Synthesize 0.5s of silent 24kHz PCM for audio testing
      const silentBuffer = Buffer.alloc(24000); // 0.5 sec at 24kHz 16-bit
      this.send({
        type: 'audio.chunk',
        pcm24Base64: silentBuffer.toString('base64'),
      });

      this.send({
        type: 'interviewer.state',
        state: 'listening',
      });
    }, 200);
  }

  private handleLiveServerMessage(msg: any): void {
    if (!this.sessionId) return;

    // Handle Interruption (barge-in)
    if (msg.serverContent?.interrupted) {
      this.send({
        type: 'interviewer.state',
        state: 'interrupted',
      });
      return;
    }

    // Handle Model Turn & Audio Chunks
    if (msg.serverContent?.modelTurn?.parts) {
      for (const part of msg.serverContent.modelTurn.parts) {
        if (part.inlineData && part.inlineData.data) {
          this.send({
            type: 'audio.chunk',
            pcm24Base64: part.inlineData.data,
          });
          this.send({
            type: 'interviewer.state',
            state: 'speaking',
          });
        }
        if (part.text) {
          this.currentInterviewerText += part.text;
        }
      }
    }

    // Real-time spoken transcriptions
    if (msg.serverContent?.outputTranscription?.text) {
      const chunk = msg.serverContent.outputTranscription.text;
      this.currentInterviewerText += chunk;
      this.send({
        type: 'transcript.entry',
        speaker: 'interviewer',
        text: chunk,
        isFinal: false,
        timestampMs: Date.now() - this.startTimeMs,
      });
    }

    if (msg.serverContent?.inputTranscription?.text) {
      const chunk = msg.serverContent.inputTranscription.text;
      this.currentCandidateText += chunk;
      this.send({
        type: 'transcript.entry',
        speaker: 'candidate',
        text: chunk,
        isFinal: false,
        timestampMs: Date.now() - this.startTimeMs,
      });
    }

    // Turn Completion
    if (msg.serverContent?.turnComplete) {
      if (this.currentCandidateText.trim()) {
        this.recordTurn('candidate', this.currentCandidateText.trim(), 'audio_transcript');
        this.currentCandidateText = '';
      }

      if (this.currentInterviewerText.trim()) {
        this.recordTurn('interviewer', this.currentInterviewerText.trim(), 'audio_transcript');
        this.currentInterviewerText = '';
      }

      // Usage Tracking & Metering
      const usageMeta = msg.usageMetadata;
      const audioIn = usageMeta?.promptAudioTokens || 32;
      const audioOut = usageMeta?.candidatesAudioTokens || 48;
      const textIn = usageMeta?.promptTextTokens || 120;
      const textOut = usageMeta?.candidatesTextTokens || 40;

      const usageInfo = recordSessionUsage(this.sessionId, {
        inputAudioTokens: audioIn,
        outputAudioTokens: audioOut,
        textIn,
        textOut,
      });

      this.send({
        type: 'usage.update',
        usage: usageInfo,
      });

      this.send({
        type: 'interviewer.state',
        state: 'listening',
      });
    }
  }

  private async handleAudioChunk(msg: Extract<ClientMessage, { type: 'audio.chunk' }>): Promise<void> {
    if (!this.sessionId) return;

    if (this.liveSession && !this.isMockMode) {
      try {
        this.liveSession.sendRealtimeInput({
          media: {
            mimeType: 'audio/pcm;rate=16000',
            data: msg.pcm16Base64,
          },
        });
      } catch (err) {
        console.error('Error forwarding audio chunk to Live API:', err);
      }
    }
  }

  private async handleArtifactUpdate(msg: Extract<ClientMessage, { type: 'artifact.update' }>): Promise<void> {
    if (!this.sessionId) return;
    const offsetMs = Date.now() - this.startTimeMs;

    // Persist snapshot to SQLite
    sqlite
      .prepare(
        `INSERT INTO interview_snapshots (
           session_id, t_offset_ms, kind, content_hash, content_text
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(this.sessionId, offsetMs, msg.kind, msg.contentHash, msg.contentText);

    this.recordEvent('snapshot', { kind: msg.kind, hash: msg.contentHash });

    // Send digest into Live context silently
    if (this.liveSession && !this.isMockMode) {
      try {
        const prefix = msg.kind === 'diagram' ? '[DIAGRAM-DIGEST]' : '[CODE-SNAPSHOT]';
        this.liveSession.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: `${prefix}\n${msg.contentText}` }],
            },
          ],
          turnComplete: false,
        });
      } catch (err) {
        console.error('Error sending artifact update to Live API:', err);
      }
    }
  }

  private handleCandidateSpeechState(msg: Extract<ClientMessage, { type: 'candidate.speech_state' }>): void {
    if (msg.state === 'speaking') {
      // Barge-in: immediately set interviewer state to interrupted
      this.send({
        type: 'interviewer.state',
        state: 'interrupted',
      });
    }
  }

  public async handleSessionEnd(reason: string): Promise<void> {
    if (!this.sessionId) return;

    const nowIso = new Date().toISOString();
    sqlite
      .prepare(
        `UPDATE interview_sessions 
         SET status = 'completed', ended_at = ? 
         WHERE id = ?`
      )
      .run(nowIso, this.sessionId);

    this.recordEvent('session_end', { reason });

    if (this.liveSession && typeof this.liveSession.close === 'function') {
      try {
        this.liveSession.close();
      } catch (err) {
        console.warn('Error closing Live session:', err);
      }
    }

    // Get final usage
    const usageRow = sqlite
      .prepare(`SELECT * FROM interview_usage WHERE session_id = ?`)
      .get(this.sessionId) as any;

    const budgetCheck = checkBudgetGuard();
    const finalUsage: SessionUsageInfo = {
      inputAudioTokens: usageRow?.input_audio_tokens || 0,
      outputAudioTokens: usageRow?.output_audio_tokens || 0,
      textIn: usageRow?.text_in || 0,
      textOut: usageRow?.text_out || 0,
      costUsd: usageRow?.cost_usd_est || 0,
      costInr: Number(((usageRow?.cost_usd_est || 0) * INTERVIEW_CONFIG.budget.fxInrPerUsd).toFixed(4)),
      monthlyCostInr: budgetCheck.monthlyCostInr,
      budgetInr: budgetCheck.budgetInr,
      percentUsed: budgetCheck.percentUsed,
    };

    this.send({
      type: 'session.ended',
      sessionId: this.sessionId,
      reason,
      finalUsage,
    });

    this.sessionId = null;
  }

  private recordTurn(speaker: string, text: string, source = 'audio_transcript'): void {
    if (!this.sessionId) return;
    this.turnSeq += 1;
    const offsetMs = Date.now() - this.startTimeMs;

    sqlite
      .prepare(
        `INSERT INTO interview_turns (
           session_id, seq, speaker, text, t_offset_ms, source
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(this.sessionId, this.turnSeq, speaker, text, offsetMs, source);
  }

  private recordEvent(kind: string, payload: Record<string, any>): void {
    if (!this.sessionId) return;
    const offsetMs = Date.now() - this.startTimeMs;

    sqlite
      .prepare(
        `INSERT INTO interview_events (
           session_id, t_offset_ms, kind, payload_json
         ) VALUES (?, ?, ?, ?)`
      )
      .run(this.sessionId, offsetMs, kind, JSON.stringify(payload));
  }
}
