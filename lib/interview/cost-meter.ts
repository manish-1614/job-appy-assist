/**
 * Cost metering and budget enforcement engine for Mock-Interview module.
 * Adheres to ADR-004 (Cost Control, Token Metering & Budget Enforcement).
 */

import { sqlite } from '../db';
import { INTERVIEW_CONFIG } from './config';
import { BudgetInfo, SessionUsageInfo } from './protocol';

export interface TokenDelta {
  inputAudioTokens?: number;
  outputAudioTokens?: number;
  textIn?: number;
  textOut?: number;
}

/**
 * Calculates USD and INR costs from token counts.
 */
export function calculateTurnCost(
  delta: TokenDelta,
  modelType: 'live' | 'observer' | 'grader' = 'live'
): { costUsd: number; costInr: number } {
  const pricing = INTERVIEW_CONFIG.pricing[modelType];
  const fxRate = INTERVIEW_CONFIG.budget.fxInrPerUsd;

  const audioInTokens = delta.inputAudioTokens || 0;
  const audioOutTokens = delta.outputAudioTokens || 0;
  const textInTokens = delta.textIn || 0;
  const textOutTokens = delta.textOut || 0;

  const costUsd =
    (audioInTokens * pricing.audioInputPer1M +
      audioOutTokens * pricing.audioOutputPer1M +
      textInTokens * pricing.textInputPer1M +
      textOutTokens * pricing.textOutputPer1M) /
    1_000_000;

  const costInr = costUsd * fxRate;

  return {
    costUsd: Number(costUsd.toFixed(6)),
    costInr: Number(costInr.toFixed(4)),
  };
}

/**
 * Returns total expenditure in INR for a given calendar month (default: current month).
 */
export function getMonthlyUsageInr(yearMonth?: string): number {
  const currentPrefix = yearMonth || new Date().toISOString().substring(0, 7); // e.g. '2026-09'
  try {
    const row = sqlite
      .prepare(
        `SELECT COALESCE(SUM(cost_inr_est), 0) as total_inr 
         FROM interview_sessions 
         WHERE started_at LIKE ?`
      )
      .get(`${currentPrefix}%`) as { total_inr: number } | undefined;

    return row ? Number(row.total_inr.toFixed(2)) : 0;
  } catch (err) {
    console.error('Error fetching monthly usage:', err);
    return 0;
  }
}

/**
 * Evaluates monthly expenditure against the hard budget cap (ADR-004).
 */
export function checkBudgetGuard(yearMonth?: string): BudgetInfo & { allowed: boolean } {
  const budgetInr = INTERVIEW_CONFIG.budget.monthlyBudgetInr;
  const monthlyCostInr = getMonthlyUsageInr(yearMonth);
  const budgetRemainingInr = Math.max(0, budgetInr - monthlyCostInr);
  const percentUsed = Number(((monthlyCostInr / budgetInr) * 100).toFixed(2));

  let warningLevel: BudgetInfo['warningLevel'] = 'none';
  if (percentUsed >= INTERVIEW_CONFIG.budget.thresholds.block * 100) {
    warningLevel = 'blocked';
  } else if (percentUsed >= INTERVIEW_CONFIG.budget.thresholds.critical * 100) {
    warningLevel = 'critical';
  } else if (percentUsed >= INTERVIEW_CONFIG.budget.thresholds.warning * 100) {
    warningLevel = 'warning';
  } else if (percentUsed >= INTERVIEW_CONFIG.budget.thresholds.info * 100) {
    warningLevel = 'info';
  }

  const allowed = warningLevel !== 'blocked';

  return {
    monthlyCostInr,
    budgetInr,
    budgetRemainingInr,
    percentUsed,
    warningLevel,
    allowed,
  };
}

/**
 * Records or updates cumulative token and cost usage for an interview session.
 */
export function recordSessionUsage(
  sessionId: string,
  delta: TokenDelta,
  modelType: 'live' | 'observer' | 'grader' = 'live'
): SessionUsageInfo {
  const { costUsd, costInr } = calculateTurnCost(delta, modelType);

  const existing = sqlite
    .prepare(`SELECT * FROM interview_usage WHERE session_id = ?`)
    .get(sessionId) as
    | {
        input_audio_tokens: number;
        output_audio_tokens: number;
        text_in: number;
        text_out: number;
        cost_usd_est: number;
      }
    | undefined;

  const inputAudioTokens = (existing?.input_audio_tokens || 0) + (delta.inputAudioTokens || 0);
  const outputAudioTokens = (existing?.output_audio_tokens || 0) + (delta.outputAudioTokens || 0);
  const textIn = (existing?.text_in || 0) + (delta.textIn || 0);
  const textOut = (existing?.text_out || 0) + (delta.textOut || 0);
  const newCostUsd = Number(((existing?.cost_usd_est || 0) + costUsd).toFixed(6));
  const newCostInr = Number((newCostUsd * INTERVIEW_CONFIG.budget.fxInrPerUsd).toFixed(4));

  sqlite
    .prepare(
      `INSERT INTO interview_usage (
         session_id, input_audio_tokens, output_audio_tokens, text_in, text_out, cost_usd_est
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         input_audio_tokens = excluded.input_audio_tokens,
         output_audio_tokens = excluded.output_audio_tokens,
         text_in = excluded.text_in,
         text_out = excluded.text_out,
         cost_usd_est = excluded.cost_usd_est`
    )
    .run(sessionId, inputAudioTokens, outputAudioTokens, textIn, textOut, newCostUsd);

  // Update session aggregate
  sqlite
    .prepare(
      `UPDATE interview_sessions 
       SET cost_usd_est = ?, cost_inr_est = ?
       WHERE id = ?`
    )
    .run(newCostUsd, newCostInr, sessionId);

  const budgetCheck = checkBudgetGuard();

  return {
    inputAudioTokens,
    outputAudioTokens,
    textIn,
    textOut,
    costUsd: newCostUsd,
    costInr: newCostInr,
    monthlyCostInr: budgetCheck.monthlyCostInr,
    budgetInr: budgetCheck.budgetInr,
    percentUsed: budgetCheck.percentUsed,
  };
}
