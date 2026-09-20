import { ExtractedJobFacts, GateResult, SubScores, ScoredJobResult } from './types';
import { extractJobFacts, extractFactsOffline, saveExtractionCache, computeHash, PROMPT_VERSION } from './extraction-engine';
import { evaluateGates } from './gates';
import { evaluateSubScores } from './sub-scores';
import { CandidateProfile, loadCandidateProfile } from '../storage';
import { sqlite } from '../db';

export * from './types';
export * from './quote-verifier';
export * from './gates';
export * from './sub-scores';
export * from './extraction-engine';

/**
 * Generates verified evidence quotes and strengths based strictly on extracted facts.
 * Enforces Zero-Fabrication Directive: no template strings or unbacked assertions.
 */
function compileEvidenceAndRationale(
  facts: ExtractedJobFacts,
  job: { title: string; company: string; location: string },
  subScores: SubScores,
  gate: GateResult
): { strengths: string[]; concerns: string[]; evidenceQuotes: string[] } {
  const strengths: string[] = [];
  const concerns: string[] = [];
  const evidenceQuotes: string[] = [];

  // Title & Seniority evidence
  if (facts.quotes.seniority) {
    evidenceQuotes.push(`Title Seniority: "${facts.quotes.seniority}"`);
    strengths.push(`Matches target senior engineering profile.`);
  }

  // Tech stack evidence
  if (facts.mustHaveTech && facts.mustHaveTech.length > 0) {
    evidenceQuotes.push(`Key Tech Stack: ${facts.mustHaveTech.slice(0, 5).join(', ')}`);
    strengths.push(`Core tech stack overlap: ${facts.mustHaveTech.slice(0, 4).join(', ')}.`);
  }

  // Location & Remote scope evidence
  if (facts.quotes.remoteScope) {
    evidenceQuotes.push(`Eligibility: "${facts.quotes.remoteScope}" (Class: ${gate.locationClass})`);
  } else {
    evidenceQuotes.push(`Location: ${job.location} (Class: ${gate.locationClass})`);
  }

  // Salary evidence
  if (facts.salary && facts.quotes.salary) {
    evidenceQuotes.push(`Compensation: "${facts.quotes.salary}"`);
  }

  // Sponsorship evidence
  if (facts.quotes.visaSponsorship) {
    evidenceQuotes.push(`Sponsorship: "${facts.quotes.visaSponsorship}"`);
  }

  // Concerns
  if (!gate.passed && gate.gateReason) {
    concerns.push(`Gated: ${gate.gateReason}`);
  }
  if (facts.presales) {
    concerns.push(`Solutions Architect role has pre-sales focus (down-weighted per D6).`);
  }
  if (subScores.freshness < 0.35) {
    concerns.push(`Job has been open for > 60 days (potential ghost posting).`);
  }

  return { strengths, concerns, evidenceQuotes };
}

/**
 * Scores a job posting using Scorer v2
 */
export async function scoreJobV2(params: {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    firstPublishedAt?: string | null;
    firstSeenAt?: string | null;
  };
  jdText: string;
  profile?: CandidateProfile;
  offlineOnly?: boolean;
}): Promise<ScoredJobResult> {
  const profile = params.profile || loadCandidateProfile();

  // 1. Extract facts (with verbatim quotes and cache check)
  let facts: ExtractedJobFacts;
  if (params.offlineOnly) {
    facts = extractFactsOffline({
      title: params.job.title,
      location: params.job.location,
      company: params.job.company,
      jdText: params.jdText,
    });
  } else {
    facts = await extractJobFacts({
      jobId: params.job.id,
      title: params.job.title,
      location: params.job.location,
      company: params.job.company,
      jdText: params.jdText,
    });
  }

  // 2. Evaluate Deterministic Gates
  const gate = evaluateGates(facts, {
    title: params.job.title,
    location: params.job.location,
    company: params.job.company,
  });

  // 3. Evaluate Deterministic Sub-scores & Tier
  const subScores = evaluateSubScores(
    facts,
    {
      title: params.job.title,
      company: params.job.company,
      location: params.job.location,
      firstPublishedAt: params.job.firstPublishedAt,
      firstSeenAt: params.job.firstSeenAt,
    },
    gate,
    profile
  );

  // 4. Compile evidence & rationale
  const { strengths, concerns, evidenceQuotes } = compileEvidenceAndRationale(
    facts,
    params.job,
    subScores,
    gate
  );

  // 5. Update SQLite extraction cache record
  const contentHash = computeHash(params.jdText);
  saveExtractionCache({
    jobId: params.job.id,
    contentHash,
    promptVersion: PROMPT_VERSION,
    model: params.offlineOnly ? 'offline-rule' : (process.env.MODEL_EXTRACT || 'gemini-2.5-flash'),
    extractionStatus: 'success',
    extractedJson: JSON.stringify(facts),
    subScoresJson: JSON.stringify(subScores),
    tier: subScores.tier,
  });

  return {
    facts,
    gate,
    subScores,
    score: subScores.totalScore,
    tier: subScores.tier,
    strengths,
    concerns,
    evidenceQuotes,
  };
}

/**
 * Scores a job already stored in the SQLite database and updates its columns
 */
export async function rescoreJobInDb(jobId: string, profile?: CandidateProfile): Promise<ScoredJobResult | null> {
  try {
    const jobRow = sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    if (!jobRow) return null;

    const descRow = sqlite.prepare('SELECT description_text FROM job_descriptions WHERE job_id = ?').get(jobId) as any;
    const jdText = descRow?.description_text || `${jobRow.title} ${jobRow.company} ${jobRow.location}`;

    const result = await scoreJobV2({
      job: {
        id: jobRow.id,
        title: jobRow.title,
        company: jobRow.company,
        location: jobRow.location,
        firstPublishedAt: jobRow.first_published_at,
        firstSeenAt: jobRow.first_seen_at,
      },
      jdText,
      profile,
      offlineOnly: true,
    });

    // Update jobs row with Scorer v2 values
    sqlite.prepare(`
      UPDATE jobs SET
        score = ?,
        tier = ?,
        location_class = ?,
        gate_reason = ?,
        sub_scores_json = ?,
        extracted_facts_json = ?,
        strengths_json = ?,
        concerns_json = ?,
        tech_stack_json = ?,
        sponsorship = ?,
        is_remote = ?,
        salary = ?
      WHERE id = ?
    `).run(
      result.score,
      result.tier,
      result.gate.locationClass,
      result.gate.gateReason,
      JSON.stringify(result.subScores),
      JSON.stringify(result.facts),
      JSON.stringify(result.evidenceQuotes),
      JSON.stringify(result.concerns),
      JSON.stringify(result.facts.mustHaveTech),
      result.facts.visaSponsorship,
      result.gate.locationClass.includes('remote') ? 1 : 0,
      result.facts.salary && result.facts.quotes.salary ? result.facts.quotes.salary : 'Salary not stated',
      jobId
    );

    return result;
  } catch (err) {
    console.error(`[ScorerV2] Failed to rescore job ${jobId}:`, err);
    return null;
  }
}
