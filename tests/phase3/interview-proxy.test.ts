import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseClientMessage,
  serializeServerMessage,
  ClientMessage,
  ServerMessage,
} from '../../lib/interview/protocol';
import {
  calculateTurnCost,
  checkBudgetGuard,
  recordSessionUsage,
} from '../../lib/interview/cost-meter';
import {
  loadAllQuestions,
  getQuestionById,
  compileInterviewerPrompt,
} from '../../lib/interview/prompts';
import { INTERVIEW_CONFIG } from '../../lib/interview/config';
import { sqlite } from '../../lib/db';

describe('Phase 3: Mock-Interview Proxy & Protocol Suite', () => {
  beforeEach(() => {
    // Clean up test sessions from DB
    sqlite.exec(`DELETE FROM interview_sessions WHERE id LIKE 'test_%'`);
  });

  describe('1. Wire Protocol Validation & Parsing', () => {
    it('parses valid session.start message', () => {
      const raw = JSON.stringify({
        type: 'session.start',
        sessionId: 'test_ses_01',
        companyStyle: 'google',
        roundType: 'system_design',
        questionId: 'sys_flash_sale',
        candidateProfile: { name: 'Manish Kumar Prajapati' },
      });

      const parsed = parseClientMessage(raw);
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('session.start');
      if (parsed?.type === 'session.start') {
        expect(parsed.companyStyle).toBe('google');
        expect(parsed.questionId).toBe('sys_flash_sale');
      }
    });

    it('rejects malformed or invalid client messages', () => {
      expect(parseClientMessage('not-json')).toBeNull();
      expect(parseClientMessage('{}')).toBeNull();
      expect(parseClientMessage(JSON.stringify({ type: 'unknown_type' }))).toBeNull();
      expect(parseClientMessage(JSON.stringify({ type: 'session.start' }))).toBeNull();
      expect(parseClientMessage(JSON.stringify({ type: 'audio.chunk' }))).toBeNull();
    });

    it('parses audio.chunk and artifact.update messages', () => {
      const audioMsg = JSON.stringify({
        type: 'audio.chunk',
        pcm16Base64: 'AAAA',
      });
      const parsedAudio = parseClientMessage(audioMsg);
      expect(parsedAudio?.type).toBe('audio.chunk');

      const artifactMsg = JSON.stringify({
        type: 'artifact.update',
        kind: 'diagram',
        contentText: 'Client -> Gateway',
        contentHash: 'hash123',
      });
      const parsedArtifact = parseClientMessage(artifactMsg);
      expect(parsedArtifact?.type).toBe('artifact.update');
    });

    it('serializes server messages correctly', () => {
      const serverMsg: ServerMessage = {
        type: 'session.ready',
        sessionId: 'test_ses_02',
        liveModel: 'gemini-2.5-flash',
        budgetInfo: {
          monthlyCostInr: 100,
          budgetInr: 15000,
          budgetRemainingInr: 14900,
          percentUsed: 0.67,
          warningLevel: 'none',
        },
      };

      const serialized = serializeServerMessage(serverMsg);
      const parsed = JSON.parse(serialized);
      expect(parsed.type).toBe('session.ready');
      expect(parsed.liveModel).toBe('gemini-2.5-flash');
      expect(parsed.budgetInfo.budgetInr).toBe(15000);
    });
  });

  describe('2. Cost Meter & Budget Guard', () => {
    it('calculates token costs correctly based on pricing matrix', () => {
      // 10,000 input audio tokens ($3/1M) + 5,000 output audio tokens ($12/1M)
      // costUsd = (10000 * 3 + 5000 * 12) / 1,000,000 = (30000 + 60000) / 1,000,000 = 0.09 USD
      const { costUsd, costInr } = calculateTurnCost({
        inputAudioTokens: 10000,
        outputAudioTokens: 5000,
        textIn: 0,
        textOut: 0,
      });

      expect(costUsd).toBe(0.09);
      expect(costInr).toBe(Number((0.09 * INTERVIEW_CONFIG.budget.fxInrPerUsd).toFixed(4)));
    });

    it('determines budget guard thresholds correctly', () => {
      // Insert a mock session with heavy cost for month '2099-01'
      const testMonth = '2099-01';
      sqlite
        .prepare(
          `INSERT INTO interview_sessions (
             id, started_at, company_style, round_type, question_id, live_model, status, cost_inr_est
           ) VALUES ('test_budget_session', '2099-01-15T10:00:00Z', 'google', 'system_design', 'sys_flash_sale', 'gemini-2.5-flash', 'completed', ?)`
        )
        .run(12500); // 12,500 INR = 83.3% of 15,000 -> warning level 'warning'

      const guard = checkBudgetGuard(testMonth);
      expect(guard.monthlyCostInr).toBe(12500);
      expect(guard.percentUsed).toBe(83.33);
      expect(guard.warningLevel).toBe('warning');
      expect(guard.allowed).toBe(true);

      // Now push beyond 15,000
      sqlite
        .prepare(`UPDATE interview_sessions SET cost_inr_est = 15500 WHERE id = 'test_budget_session'`)
        .run();

      const guardBlocked = checkBudgetGuard(testMonth);
      expect(guardBlocked.percentUsed).toBeGreaterThanOrEqual(100);
      expect(guardBlocked.warningLevel).toBe('blocked');
      expect(guardBlocked.allowed).toBe(false);
    });

    it('records and updates session usage in database', () => {
      const testId = 'test_usage_session';
      sqlite
        .prepare(
          `INSERT INTO interview_sessions (
             id, started_at, company_style, round_type, question_id, live_model, status, cost_usd_est, cost_inr_est
           ) VALUES (?, '2026-09-21T10:00:00Z', 'toptal', 'advanced_dsa_cpp', 'dsa_burst_balloons', 'gemini-2.5-flash', 'active', 0, 0)`
        )
        .run(testId);

      const usage = recordSessionUsage(testId, {
        inputAudioTokens: 5000,
        outputAudioTokens: 2000,
        textIn: 500,
        textOut: 100,
      });

      expect(usage.inputAudioTokens).toBe(5000);
      expect(usage.outputAudioTokens).toBe(2000);
      expect(usage.costUsd).toBeGreaterThan(0);

      const dbUsage = sqlite
        .prepare(`SELECT * FROM interview_usage WHERE session_id = ?`)
        .get(testId) as any;
      expect(dbUsage.input_audio_tokens).toBe(5000);
      expect(dbUsage.output_audio_tokens).toBe(2000);
    });
  });

  describe('3. Question Loading & Prompt Compilation', () => {
    it('loads all question packs without error', () => {
      const questions = loadAllQuestions();
      expect(questions.length).toBeGreaterThanOrEqual(10);

      const flashSale = getQuestionById('sys_flash_sale');
      expect(flashSale).toBeDefined();
      expect(flashSale?.roundType).toBe('system_design');
      expect(flashSale?.title).toContain('Flash-Sale');
    });

    it('compiles system prompts with dynamic interpolation', () => {
      const { systemPrompt, question } = compileInterviewerPrompt({
        companyStyle: 'google',
        roundType: 'system_design',
        questionId: 'sys_flash_sale',
        timeLimitMinutes: 45,
      });

      expect(question.id).toBe('sys_flash_sale');
      expect(systemPrompt).toContain('Google');
      expect(systemPrompt).toContain('SYSTEM DESIGN');
      expect(systemPrompt).toContain('45 minutes');
      expect(systemPrompt).toContain(question.interviewerPrompt);
      expect(systemPrompt).not.toContain('{COMPANY_STYLE}');
      expect(systemPrompt).not.toContain('{QUESTION}');
    });
  });
});
