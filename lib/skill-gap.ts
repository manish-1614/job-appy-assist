import { CandidateProfile, getVerifiedSkills, loadCanonicalJobs, loadCandidateProfile } from './storage';
import { EvaluatedJob } from './ats-adapters';

export interface SkillGapItem {
  skill: string;
  demandCount: number;
  demandPercentage: number;
  verifiedByCandidate: boolean;
  isMissing: boolean;
  sampleJobs: { id: string; title: string; company: string }[];
}

export interface SkillGapSummary {
  totalAnalyzedJobs: number;
  tierAJobsCount: number;
  tierBJobsCount: number;
  topMissingSkills: SkillGapItem[];
  topMatchedSkills: SkillGapItem[];
  overallCoverageRate: number;
}

/**
 * Normalizes skill names for case-insensitive matching
 */
function normalizeSkill(s: string): string {
  return s.trim();
}

export function aggregateSkillGaps(
  profile?: CandidateProfile,
  inputJobs?: EvaluatedJob[]
): SkillGapSummary {
  const p = profile || loadCandidateProfile();
  const rawJobs = inputJobs || loadCanonicalJobs();

  // Filter only open Tier A and Tier B jobs (or score >= 60)
  const targetJobs = rawJobs.filter(
    j => (j.status === 'open' || !j.status) && (j.tier === 'tier_a' || j.tier === 'tier_b' || j.score >= 60)
  );

  const tierACount = targetJobs.filter(j => j.tier === 'tier_a' || j.score >= 75).length;
  const tierBCount = targetJobs.length - tierACount;

  const verifiedSkillsList = getVerifiedSkills(p);
  const verifiedLowerSet = new Set(verifiedSkillsList.map(s => s.toLowerCase().trim()));

  // Map skill -> { demandCount, sampleJobs }
  const skillStats = new Map<
    string,
    { canonicalName: string; count: number; jobs: { id: string; title: string; company: string }[] }
  >();

  for (const job of targetJobs) {
    const tech = Array.isArray(job.techStack) ? job.techStack : [];
    const seenInJob = new Set<string>();

    for (const rawSkill of tech) {
      const trimmed = normalizeSkill(rawSkill);
      if (!trimmed || trimmed.length < 2) continue;
      const lower = trimmed.toLowerCase();
      if (seenInJob.has(lower)) continue;
      seenInJob.add(lower);

      if (!skillStats.has(lower)) {
        skillStats.set(lower, { canonicalName: trimmed, count: 0, jobs: [] });
      }

      const stat = skillStats.get(lower)!;
      stat.count++;
      if (stat.jobs.length < 5) {
        stat.jobs.push({ id: job.id, title: job.title, company: job.company });
      }
    }
  }

  const missingSkills: SkillGapItem[] = [];
  const matchedSkills: SkillGapItem[] = [];

  const totalJobs = targetJobs.length;

  for (const [lower, stat] of skillStats.entries()) {
    const isVerified = verifiedLowerSet.has(lower);
    const item: SkillGapItem = {
      skill: stat.canonicalName,
      demandCount: stat.count,
      demandPercentage: totalJobs > 0 ? Math.round((stat.count / totalJobs) * 100) : 0,
      verifiedByCandidate: isVerified,
      isMissing: !isVerified,
      sampleJobs: stat.jobs,
    };

    if (isVerified) {
      matchedSkills.push(item);
    } else {
      missingSkills.push(item);
    }
  }

  // Sort descending by demand
  missingSkills.sort((a, b) => b.demandCount - a.demandCount);
  matchedSkills.sort((a, b) => b.demandCount - a.demandCount);

  const totalDemandMentions = [...missingSkills, ...matchedSkills].reduce((acc, s) => acc + s.demandCount, 0);
  const matchedDemandMentions = matchedSkills.reduce((acc, s) => acc + s.demandCount, 0);
  const overallCoverageRate =
    totalDemandMentions > 0 ? Math.round((matchedDemandMentions / totalDemandMentions) * 100) : 100;

  return {
    totalAnalyzedJobs: totalJobs,
    tierAJobsCount: tierACount,
    tierBJobsCount: tierBCount,
    topMissingSkills: missingSkills.slice(0, 20),
    topMatchedSkills: matchedSkills.slice(0, 20),
    overallCoverageRate,
  };
}
