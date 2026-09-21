/**
 * Configuration, models, and cost metering constants for Mock-Interview module.
 * Adheres to ADR-003 (Model Registry) and ADR-004 (Cost Control).
 */

export interface ModelPricing {
  audioInputPer1M: number;
  audioOutputPer1M: number;
  textInputPer1M: number;
  textOutputPer1M: number;
}

export const INTERVIEW_CONFIG = {
  // Network configuration
  wsHost: process.env.INTERVIEW_WS_HOST || '127.0.0.1',
  wsPort: Number(process.env.INTERVIEW_WS_PORT || 4001),

  // Model identifiers (ADR-003)
  models: {
    live: process.env.INTERVIEW_LIVE_MODEL || 'gemini-2.5-flash',
    observer: process.env.INTERVIEW_OBSERVER_MODEL || 'gemini-2.5-flash-lite',
    grader: process.env.INTERVIEW_GRADER_MODEL || 'gemini-2.5-pro',
  },

  // Budget & limits (ADR-004)
  budget: {
    monthlyBudgetInr: Number(process.env.INTERVIEW_MONTHLY_BUDGET_INR || 15000),
    sessionMaxMinutes: Number(process.env.INTERVIEW_SESSION_MAX_MINUTES || 60),
    sessionMaxCostInr: Number(process.env.INTERVIEW_SESSION_MAX_COST_INR || 500),
    fxInrPerUsd: Number(process.env.INTERVIEW_FX_INR_PER_USD || 85.00),

    // Warning triggers (percentage of monthly budget)
    thresholds: {
      info: 0.50,     // 50% reached -> info banner
      warning: 0.80,  // 80% reached -> amber alert
      critical: 0.95, // 95% reached -> red warning
      block: 1.00,    // 100% reached -> block new sessions
    },
  },

  // Token & Audio pricing (USD per 1,000,000 units)
  pricing: {
    live: {
      audioInputPer1M: 3.00,
      audioOutputPer1M: 12.00,
      textInputPer1M: 0.75,
      textOutputPer1M: 4.50,
    },
    observer: {
      audioInputPer1M: 0,
      audioOutputPer1M: 0,
      textInputPer1M: 0.075,
      textOutputPer1M: 0.30,
    },
    grader: {
      audioInputPer1M: 0,
      audioOutputPer1M: 0,
      textInputPer1M: 1.25,
      textOutputPer1M: 5.00,
    },
  },

  // Observer Policy Limits
  observer: {
    silenceThresholdSeconds: 4,
    cooldownSeconds: 90,
    maxInterjectionsPerSession: 4,
    openingGracePeriodSeconds: 180,
  },
} as const;

export type InterviewConfig = typeof INTERVIEW_CONFIG;
