import { ExtractedJobFacts, GateResult, SubScores } from './types';
import { CandidateProfile, getVerifiedSkills } from '../storage';
import { FX_TO_INR } from './gates';

export interface SubScoreWeights {
  roleFit: number;
  stackOverlap: number;
  reachability: number;
  domainAffinity: number;
  freshness: number;
  compFit: number;
  companySignal: number;
}

export const INITIAL_WEIGHTS: SubScoreWeights = {
  roleFit: 0.30,
  stackOverlap: 0.20,
  reachability: 0.15,
  domainAffinity: 0.10,
  freshness: 0.10,
  compFit: 0.10,
  companySignal: 0.05,
};

/**
 * Normalizes keyword for boundary matching
 */
function escapeRegex(str: string): string {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * 1. Role Fit Sub-Score (0.30 weight)
 * Combines role family priority (D7) and title seniority alignment
 */
export function calculateRoleFit(
  facts: ExtractedJobFacts,
  title: string
): number {
  const family = facts.roleFamily;
  let familyScore = 0.20;

  switch (family) {
    case 'backend_distributed':
      familyScore = 1.0;
      break;
    case 'ai_agentic':
      familyScore = 0.95;
      break;
    case 'architect':
      familyScore = facts.presales ? 0.70 : 0.85; // D6: downweighted if presales
      break;
    case 'fullstack_backend':
      familyScore = 0.75;
      break;
    default:
      familyScore = 0.20;
  }

  // Seniority multiplier
  const t = title.toLowerCase();
  let seniorityMultiplier = 0.85;
  if (/\b(staff|principal|lead|architect|senior|sr)\b/i.test(t)) {
    seniorityMultiplier = 1.0;
  } else if (/\b(head|director|manager)\b/i.test(t)) {
    seniorityMultiplier = 0.75;
  }

  return Math.min(1.0, Math.max(0.0, familyScore * seniorityMultiplier));
}

/**
 * 2. Stack Overlap Sub-Score (0.20 weight)
 * Matches mustHaveTech (2x) and niceToHaveTech (1x) against verified candidate skills only
 */
export function calculateStackOverlap(
  facts: ExtractedJobFacts,
  profile: CandidateProfile
): number {
  const verifiedSkills = getVerifiedSkills(profile);
  const normalizedCandidateSkills = verifiedSkills.map((s) => s.toLowerCase());

  const mustHaves = facts.mustHaveTech || [];
  const niceToHaves = facts.niceToHaveTech || [];

  if (mustHaves.length === 0 && niceToHaves.length === 0) {
    return 0.50; // Neutral fallback when JD doesn't state explicit tech
  }

  let mustMatchCount = 0;
  for (const tech of mustHaves) {
    const techLower = tech.toLowerCase();
    const isMatched = normalizedCandidateSkills.some((candSkill) => {
      const pattern = new RegExp(`\\b${escapeRegex(techLower)}\\b`, 'i');
      return pattern.test(candSkill) || candSkill.includes(techLower) || techLower.includes(candSkill);
    });
    if (isMatched) mustMatchCount++;
  }

  let niceMatchCount = 0;
  for (const tech of niceToHaves) {
    const techLower = tech.toLowerCase();
    const isMatched = normalizedCandidateSkills.some((candSkill) => {
      const pattern = new RegExp(`\\b${escapeRegex(techLower)}\\b`, 'i');
      return pattern.test(candSkill) || candSkill.includes(techLower) || techLower.includes(candSkill);
    });
    if (isMatched) niceMatchCount++;
  }

  const weightedMatches = mustMatchCount * 2 + niceMatchCount;
  const maxPossible = Math.max(1, mustHaves.length) * 2 + niceToHaves.length;

  return Math.min(1.0, Math.max(0.0, weightedMatches / maxPossible));
}

/**
 * 3. Reachability Sub-Score (0.15 weight)
 * Candidate experience (~8.5 years) vs required years & seniority. Staff/Principal not auto-boosted.
 */
export function calculateReachability(
  facts: ExtractedJobFacts,
  profile: CandidateProfile
): number {
  const candidateYears = profile.candidate?.yearsOfExperience || 8.5;
  const yearsReq = facts.yearsRequired;

  if (yearsReq !== null && yearsReq !== undefined && yearsReq > 0) {
    if (yearsReq <= 3) return 0.50; // Overqualified / flight risk
    if (yearsReq <= 9) return 1.00; // Optimal match (5-9 years)
    if (yearsReq <= 12) return 0.85; // Reachable stretch
    if (yearsReq <= 15) return 0.60; // Significant stretch
    return 0.35; // Unlikely conversion (15+ years)
  }

  // Fallback to seniority level if years not explicit
  switch (facts.seniority) {
    case 'senior':
      return 1.00;
    case 'staff_principal':
      return 0.85; // Realistic conversion, not auto-boosted
    case 'lead_manager':
      return 0.80;
    case 'mid':
      return 0.65;
    default:
      return 0.75;
  }
}

/**
 * 4. Domain Affinity Sub-Score (0.10 weight)
 * Telecom/BSS/OSS/CRM/billing (Amdocs), Japan-telecom (D8), AI Platform (Smriti)
 */
export function calculateDomainAffinity(
  facts: ExtractedJobFacts,
  title: string,
  location: string
): number {
  const combined = [
    ...(facts.domainTags || []),
    title,
    location,
  ].join(' ').toLowerCase();

  let hits = 0;

  // Domain 1: Telecom / CRM / Billing / High-Throughput
  if (/\b(telecom|crm|billing|bss|oss|high-throughput|distributed systems|messaging)\b/i.test(combined)) {
    hits++;
  }

  // Domain 2: AI Agents / Retrieval / Vector DB / LLM Orchestration
  if (/\b(ai agent|llm|retrieval|vector|agentic|rag|smriti)\b/i.test(combined)) {
    hits++;
  }

  // Domain 3: Japan-Telecom / SaaS (D8)
  if (/\b(japan|tokyo|rakuten|line|softbank)\b/i.test(combined)) {
    hits++;
  }

  if (hits >= 2) return 1.00;
  if (hits === 1) return 0.80;
  if (/\b(saas|cloud|enterprise|platform)\b/i.test(combined)) return 0.55;
  return 0.35;
}

/**
 * 5. Freshness Sub-Score (0.10 weight)
 * Days since first published; applies ghost-job penalty for roles > 90 days open
 */
export function calculateFreshness(
  firstPublishedAt: string | null | undefined,
  firstSeenAt: string | null | undefined
): number {
  const dateStr = firstPublishedAt || firstSeenAt;
  if (!dateStr) return 0.70;

  const publishedDate = new Date(dateStr).getTime();
  const now = Date.now();
  const daysOld = Math.max(0, Math.floor((now - publishedDate) / (1000 * 60 * 60 * 24)));

  if (daysOld <= 7) return 1.00;
  if (daysOld <= 14) return 0.85;
  if (daysOld <= 30) return 0.70;
  if (daysOld <= 60) return 0.50;
  if (daysOld <= 90) return 0.30;
  return 0.10; // > 90 days: ghost job penalty
}

/**
 * 6. Comp Fit Sub-Score (0.10 weight)
 * Target range: INR 35-65 LPA. Neutral (0.60) if unstated.
 */
export function calculateCompFit(
  salary: ExtractedJobFacts['salary']
): number {
  if (!salary || !salary.max || salary.max <= 0) {
    return 0.60; // Neutral when unstated
  }

  const currency = (salary.currency || 'USD').toUpperCase();
  const rate = FX_TO_INR[currency] || 84.0;

  let annualMax = salary.max;
  if (salary.period === 'hourly') annualMax = salary.max * 2000;
  else if (salary.period === 'monthly') annualMax = salary.max * 12;

  const annualInr = annualMax * rate;

  if (annualInr >= 50_00_000) return 1.00; // Top of target or higher
  if (annualInr >= 35_00_000) return 0.85; // Within 35-65L target
  if (annualInr >= 28_00_000) return 0.70;
  if (annualInr >= 25_00_000) return 0.55;
  return 0.20;
}

/**
 * 7. Company Signal Sub-Score (0.05 weight)
 * High signal for top-tier remote-first engineering employers
 */
export function calculateCompanySignal(
  company: string,
  isRemote: boolean
): number {
  const topTierRemoteCompanies = [
    'stripe',
    'linear',
    'datadog',
    'gitlab',
    'vercel',
    'supabase',
    'automattic',
    'github',
    'postman',
    'canonical',
  ];

  const c = company.toLowerCase();
  const isTopTier = topTierRemoteCompanies.some((name) => c.includes(name));

  if (isTopTier && isRemote) return 1.00;
  if (isTopTier) return 0.85;
  if (isRemote) return 0.75;
  return 0.60;
}

/**
 * Evaluates all 7 sub-scores and computes deterministic overall score & tier
 */
export function evaluateSubScores(
  facts: ExtractedJobFacts,
  job: {
    title: string;
    company: string;
    location: string;
    firstPublishedAt?: string | null;
    firstSeenAt?: string | null;
  },
  gate: GateResult,
  profile: CandidateProfile,
  weights: SubScoreWeights = INITIAL_WEIGHTS
): SubScores {
  const roleFit = calculateRoleFit(facts, job.title);
  const stackOverlap = calculateStackOverlap(facts, profile);
  const reachability = calculateReachability(facts, profile);
  const domainAffinity = calculateDomainAffinity(facts, job.title, job.location);
  const freshness = calculateFreshness(job.firstPublishedAt, job.firstSeenAt);
  const compFit = calculateCompFit(facts.salary);
  const companySignal = calculateCompanySignal(job.company, facts.remoteScope !== 'onsite');

  const weightedSum =
    weights.roleFit * roleFit +
    weights.stackOverlap * stackOverlap +
    weights.reachability * reachability +
    weights.domainAffinity * domainAffinity +
    weights.freshness * freshness +
    weights.compFit * compFit +
    weights.companySignal * companySignal;

  let totalScore = Math.round(100 * weightedSum);

  // If role failed any hard gate, cap score at 59 and set tier C / gated
  if (!gate.passed) {
    totalScore = Math.min(59, totalScore);
    return {
      roleFit,
      stackOverlap,
      reachability,
      domainAffinity,
      freshness,
      compFit,
      companySignal,
      totalScore,
      tier: 'tier_c',
    };
  }

  // Tier classification:
  // Tier A: score >= 75, passed all gates, locationClass !== 'unknown'
  // Tier B: 60 <= score < 75
  // Tier C: score < 60
  let tier: 'tier_a' | 'tier_b' | 'tier_c' = 'tier_c';
  if (totalScore >= 75 && gate.locationClass !== 'unknown') {
    tier = 'tier_a';
  } else if (totalScore >= 60) {
    tier = 'tier_b';
  } else {
    tier = 'tier_c';
  }

  return {
    roleFit,
    stackOverlap,
    reachability,
    domainAffinity,
    freshness,
    compFit,
    companySignal,
    totalScore,
    tier,
  };
}
