import { EvaluatedJob } from './ats-adapters';

/**
 * Enforces employer diversity cap on a list of ranked jobs.
 * Ensures no single employer occupies more than maxShareRatio (default 20%) of the list.
 */
export function applyEmployerDiversityCap(
  jobs: EvaluatedJob[],
  limit: number = 50,
  maxShareRatio: number = 0.20,
  fillRemaining: boolean = false
): EvaluatedJob[] {
  if (!jobs || jobs.length === 0) return [];
  if (jobs.length <= 1) return jobs.slice(0, limit);

  // Ceiling per company for target limit: e.g. 50 * 0.20 = 10
  const maxPerCompany = Math.max(1, Math.floor(limit * maxShareRatio));

  const result: EvaluatedJob[] = [];
  const deferred: EvaluatedJob[] = [];
  const companyCounts = new Map<string, number>();

  for (const job of jobs) {
    const key = (job.company || 'Unknown').trim().toLowerCase();
    const count = companyCounts.get(key) || 0;

    if (count < maxPerCompany) {
      result.push(job);
      companyCounts.set(key, count + 1);
      if (result.length >= limit) {
        return result;
      }
    } else {
      deferred.push(job);
    }
  }

  // Only draw from deferred if caller explicitly permits violating the cap
  if (fillRemaining && result.length < limit) {
    for (const job of deferred) {
      if (result.length >= limit) break;
      result.push(job);
    }
  }

  return result.slice(0, limit);
}
