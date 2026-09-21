/**
 * Observer Service: Background evaluation engine detecting candidate drift, stalls, and omissions.
 * Invokes INTERVIEW_CONFIG.models.observer (gemini-2.5-flash-lite).
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { INTERVIEW_CONFIG } from './config';
import { QuestionDefinition } from './prompts';

export interface InterviewObserverOutput {
  status: 'on_track' | 'drifting' | 'stuck' | 'off_track';
  confidence: number;
  evidence: string[];
  missing_topics: string[];
  suggested_probe: string;
}

export interface ObserverEvaluationInput {
  sessionId: string;
  question: QuestionDefinition;
  diagramDigest?: string;
  codeDigest?: string;
  recentTurns: Array<{ speaker: string; text: string }>;
  elapsedMinutes: number;
  previousProbes?: string[];
}

const PROMPT_PATH = path.resolve(process.cwd(), 'docs/interview/pack/prompts/observer.system.md');

export class InterviewObserverService {
  private aiClient: GoogleGenAI | null = null;
  private isMockMode: boolean = false;
  private systemPrompt: string = '';

  constructor(isMockMode = false) {
    this.isMockMode = isMockMode || process.env.MOCK_LIVE === 'true';
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && !this.isMockMode) {
      this.aiClient = new GoogleGenAI({ apiKey });
    } else {
      this.isMockMode = true;
    }

    if (fs.existsSync(PROMPT_PATH)) {
      this.systemPrompt = fs
        .readFileSync(PROMPT_PATH, 'utf8')
        .replace(/^#\s*.*\n+```markdown\n?/i, '')
        .replace(/```\s*$/i, '')
        .trim();
    } else {
      this.systemPrompt = 'You are an adversarial background co-interviewer. Return JSON matching InterviewObserverOutput.';
    }
  }

  public async evaluate(input: ObserverEvaluationInput): Promise<InterviewObserverOutput> {
    if (this.isMockMode || !this.aiClient) {
      return this.evaluateMock(input);
    }

    const payloadText = JSON.stringify({
      problem_statement: input.question.interviewerPrompt,
      hidden_reference: input.question.hiddenReference || {},
      elapsed_minutes: input.elapsedMinutes,
      diagram_digest: input.diagramDigest || 'None',
      code_digest: input.codeDigest || 'None',
      recent_transcript: input.recentTurns.slice(-8),
      previous_probes: input.previousProbes || [],
    });

    try {
      const response = await this.aiClient.models.generateContent({
        model: INTERVIEW_CONFIG.models.observer,
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${this.systemPrompt}\n\nEVALUATION CONTEXT:\n${payloadText}` },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const rawJson = response.text?.trim() || '{}';
      const parsed = JSON.parse(rawJson) as InterviewObserverOutput;

      if (
        ['on_track', 'drifting', 'stuck', 'off_track'].includes(parsed.status) &&
        typeof parsed.suggested_probe === 'string'
      ) {
        return parsed;
      }

      return this.evaluateMock(input);
    } catch (err) {
      console.warn('Observer LLM generation failed, falling back to heuristic evaluation:', err);
      return this.evaluateMock(input);
    }
  }

  private evaluateMock(input: ObserverEvaluationInput): InterviewObserverOutput {
    const combinedText = (
      (input.diagramDigest || '') +
      ' ' +
      (input.codeDigest || '') +
      ' ' +
      input.recentTurns.map((t) => t.text).join(' ')
    ).toLowerCase();

    // Check critical topics for system design
    if (input.question.roundType === 'system_design') {
      const missing: string[] = [];
      if (!combinedText.includes('spike') && !combinedText.includes('rate limit') && !combinedText.includes('burst')) {
        missing.push('traffic_spikes_and_backpressure');
      }
      if (!combinedText.includes('kafka') && !combinedText.includes('queue') && !combinedText.includes('outbox')) {
        missing.push('asynchronous_decoupling');
      }
      if (!combinedText.includes('failover') && !combinedText.includes('partition') && !combinedText.includes('spof')) {
        missing.push('fault_tolerance_and_spof');
      }

      if (missing.length > 0) {
        const probeMap: Record<string, string> = {
          traffic_spikes_and_backpressure:
            'How would your architecture absorb an instantaneous 50x surge without database connection exhaustion?',
          asynchronous_decoupling:
            'How are your write paths decoupled to guarantee zero message loss during peak load?',
          fault_tolerance_and_spof:
            'What is the single point of failure in your diagram if a primary database node fails?',
        };

        return {
          status: 'drifting',
          confidence: 0.85,
          evidence: [`Omission of critical pillars: ${missing.join(', ')}`],
          missing_topics: missing,
          suggested_probe: probeMap[missing[0]] || 'What happens when load increases significantly?',
        };
      }

      return {
        status: 'on_track',
        confidence: 0.9,
        evidence: ['Candidate has addressed spikes, queues, and database boundaries.'],
        missing_topics: [],
        suggested_probe: 'What consistency tradeoffs are you making here?',
      };
    }

    // Default DSA or behavioral response
    return {
      status: 'on_track',
      confidence: 0.8,
      evidence: ['Initial requirements and setup under exploration.'],
      missing_topics: [],
      suggested_probe: 'Could you walk through the time and space complexity of this approach?',
    };
  }
}
