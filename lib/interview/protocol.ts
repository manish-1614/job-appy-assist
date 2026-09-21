/**
 * WebSocket Wire Protocol TypeScript definitions and validators for Mock-Interview module.
 * Documented in docs/interview/03-protocol.md
 */

export interface BudgetInfo {
  monthlyCostInr: number;
  budgetInr: number;
  budgetRemainingInr: number;
  percentUsed: number;
  warningLevel: 'none' | 'info' | 'warning' | 'critical' | 'blocked';
  allowed: boolean;
}

export interface SessionUsageInfo {
  inputAudioTokens: number;
  outputAudioTokens: number;
  textIn: number;
  textOut: number;
  costUsd: number;
  costInr: number;
  monthlyCostInr: number;
  budgetInr: number;
  percentUsed: number;
}

// ==================== Client -> Server Messages ====================

export interface SessionStartMessage {
  type: 'session.start';
  sessionId: string;
  companyStyle: 'google' | 'toptal';
  roundType: 'system_design' | 'advanced_dsa_cpp' | 'behavioral' | 'communication';
  questionId: string;
  candidateProfile?: {
    name?: string;
    yearsExperience?: number;
    skills?: string[];
  };
}

export interface AudioChunkClientMessage {
  type: 'audio.chunk';
  pcm16Base64: string;
  timestampMs?: number;
}

export interface ArtifactUpdateMessage {
  type: 'artifact.update';
  kind: 'code' | 'diagram';
  contentText: string;
  contentHash: string;
  timestampMs?: number;
}

export interface CandidateSpeechStateMessage {
  type: 'candidate.speech_state';
  state: 'speaking' | 'silent' | 'interrupted';
}

export interface SessionEndMessage {
  type: 'session.end';
  reason?: string;
}

export type ClientMessage =
  | SessionStartMessage
  | AudioChunkClientMessage
  | ArtifactUpdateMessage
  | CandidateSpeechStateMessage
  | SessionEndMessage;

// ==================== Server -> Client Messages ====================

export interface SessionReadyMessage {
  type: 'session.ready';
  sessionId: string;
  liveModel: string;
  budgetInfo: BudgetInfo;
}

export interface AudioChunkServerMessage {
  type: 'audio.chunk';
  pcm24Base64: string;
  turnId?: number;
}

export interface TranscriptEntryMessage {
  type: 'transcript.entry';
  speaker: 'interviewer' | 'candidate' | 'observer' | 'system';
  text: string;
  isFinal: boolean;
  turnId?: number;
  timestampMs?: number;
}

export interface InterviewerStateMessage {
  type: 'interviewer.state';
  state: 'idle' | 'listening' | 'thinking' | 'speaking' | 'interrupted';
  rms?: number;
}

export interface ObserverCueMessage {
  type: 'observer.cue';
  cueType: string;
  message: string;
}

export interface UsageUpdateMessage {
  type: 'usage.update';
  usage: SessionUsageInfo;
}

export interface SessionEndedMessage {
  type: 'session.ended';
  sessionId: string;
  reason: string;
  finalUsage?: SessionUsageInfo;
}

export interface ErrorMessage {
  type: 'error';
  code:
    | 'BUDGET_EXCEEDED'
    | 'SESSION_MAX_DURATION'
    | 'LIVE_CONNECTION_FAILED'
    | 'AUDIO_DECODE_ERROR'
    | 'UPSTREAM_DROPPED'
    | 'INVALID_MESSAGE'
    | 'INTERNAL_ERROR';
  message: string;
  fatal: boolean;
}

export type ServerMessage =
  | SessionReadyMessage
  | AudioChunkServerMessage
  | TranscriptEntryMessage
  | InterviewerStateMessage
  | ObserverCueMessage
  | UsageUpdateMessage
  | SessionEndedMessage
  | ErrorMessage;

// ==================== Parsing and Validation ====================

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
      return null;
    }

    switch (data.type) {
      case 'session.start':
        if (
          typeof data.sessionId === 'string' &&
          typeof data.companyStyle === 'string' &&
          typeof data.roundType === 'string' &&
          typeof data.questionId === 'string'
        ) {
          return data as SessionStartMessage;
        }
        return null;

      case 'audio.chunk':
        if (typeof data.pcm16Base64 === 'string') {
          return data as AudioChunkClientMessage;
        }
        return null;

      case 'artifact.update':
        if (
          (data.kind === 'code' || data.kind === 'diagram') &&
          typeof data.contentText === 'string' &&
          typeof data.contentHash === 'string'
        ) {
          return data as ArtifactUpdateMessage;
        }
        return null;

      case 'candidate.speech_state':
        if (['speaking', 'silent', 'interrupted'].includes(data.state)) {
          return data as CandidateSpeechStateMessage;
        }
        return null;

      case 'session.end':
        return data as SessionEndMessage;

      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
