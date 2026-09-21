/**
 * Deterministic Policy Engine for Observer-Initiated Interjections.
 * Strictly enforces rules from HLD 3.2:
 * 1. Silence guard: Candidate must be silent for >= 4 seconds.
 * 2. Cooldown: >= 90 seconds between observer-initiated spoken interjections.
 * 3. Frequency cap: Maximum 4 interjections per session.
 * 4. Opening grace period: Zero interruptions during the initial 3 minutes (180s).
 */

import { INTERVIEW_CONFIG } from './config';

export interface PolicyState {
  sessionStartMs: number;
  lastInterjectionMs: number | null;
  interjectionCount: number;
  candidateLastSpokeMs: number;
  isCandidateSpeaking: boolean;
}

export interface PolicyDecision {
  allow: boolean;
  reason: string;
}

export class ObserverPolicyEngine {
  private state: PolicyState;
  private config = INTERVIEW_CONFIG.observer;

  constructor(sessionStartMs = Date.now()) {
    this.state = {
      sessionStartMs,
      lastInterjectionMs: null,
      interjectionCount: 0,
      candidateLastSpokeMs: sessionStartMs,
      isCandidateSpeaking: false,
    };
  }

  public onCandidateSpeechChange(isSpeaking: boolean, nowMs = Date.now()): void {
    this.state.isCandidateSpeaking = isSpeaking;
    if (isSpeaking) {
      this.state.candidateLastSpokeMs = nowMs;
    }
  }

  public evaluateInterjection(nowMs = Date.now()): PolicyDecision {
    const elapsedSeconds = (nowMs - this.state.sessionStartMs) / 1000;

    // 1. Opening grace period (first 3 minutes)
    if (elapsedSeconds < this.config.openingGracePeriodSeconds) {
      return {
        allow: false,
        reason: `Inside opening grace period (${Math.round(elapsedSeconds)}s < ${this.config.openingGracePeriodSeconds}s)`,
      };
    }

    // 2. Frequency cap (max 4 per session)
    if (this.state.interjectionCount >= this.config.maxInterjectionsPerSession) {
      return {
        allow: false,
        reason: `Session frequency cap reached (${this.state.interjectionCount}/${this.config.maxInterjectionsPerSession})`,
      };
    }

    // 3. Candidate actively speaking
    if (this.state.isCandidateSpeaking) {
      return {
        allow: false,
        reason: 'Candidate is currently speaking (barge-in guard)',
      };
    }

    // 4. Candidate silence guard (must be silent >= 4s)
    const silenceSeconds = (nowMs - this.state.candidateLastSpokeMs) / 1000;
    if (silenceSeconds < this.config.silenceThresholdSeconds) {
      return {
        allow: false,
        reason: `Candidate silent for insufficient time (${silenceSeconds.toFixed(1)}s < ${this.config.silenceThresholdSeconds}s)`,
      };
    }

    // 5. Cooldown between interjections (>= 90s)
    if (this.state.lastInterjectionMs !== null) {
      const cooldownSeconds = (nowMs - this.state.lastInterjectionMs) / 1000;
      if (cooldownSeconds < this.config.cooldownSeconds) {
        return {
          allow: false,
          reason: `Interjection cooldown active (${Math.round(cooldownSeconds)}s < ${this.config.cooldownSeconds}s)`,
        };
      }
    }

    return {
      allow: true,
      reason: 'All policy guards passed',
    };
  }

  public recordInterjectionTriggered(nowMs = Date.now()): void {
    this.state.interjectionCount += 1;
    this.state.lastInterjectionMs = nowMs;
  }

  public getState(): Readonly<PolicyState> {
    return { ...this.state };
  }
}
