/**
 * Deduplication & Canonicalization Utilities for Job Ingestion Pipeline
 */

// Normalize URLs to canonical form by removing tracking params, trailing slashes, and protocol diffs
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking parameters
    const paramsToStrip = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'gh_jid', 'lever-origin', 'ref', 'source', 'gh_src'
    ];
    paramsToStrip.forEach(param => parsed.searchParams.delete(param));
    
    // Normalize path trailing slash
    let cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath) cleanPath = '/';

    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${cleanPath}${parsed.search ? parsed.search : ''}`;
  } catch (e) {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

// Normalize company names for fuzzy comparison (e.g. "Stripe, Inc." -> "stripe")
export function normalizeCompanyName(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|limited|llc|co|plc)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Normalize job title for title similarity comparison
export function normalizeJobTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(senior|sr|staff|principal|lead|junior|jr|full-stack|fullstack|backend|frontend)\b/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate Jaccard word similarity between two titles (0.0 to 1.0)
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(normalizeJobTitle(title1).split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalizeJobTitle(title2).split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const arr1 = Array.from(words1);
  const arr2 = Array.from(words2);

  const intersection = arr1.filter(w => words2.has(w));
  const union = new Set(arr1.concat(arr2));

  return intersection.length / union.size;
}

export interface DedupCheckResult {
  isExactUrlMatch: boolean;
  isPossibleDuplicate: boolean;
  matchedJobId?: string;
  matchedJobTitle?: string;
  confidenceScore: number;
  reason?: string;
}

/**
 * Perform Two-Tier Deduplication check against an existing set of jobs
 */
export function checkJobDeduplication(
  incoming: { company: string; title: string; applyUrl: string },
  existingJobs: { id: string; company: string; title: string; canonicalUrl: string }[]
): DedupCheckResult {
  const incomingCanonical = canonicalizeUrl(incoming.applyUrl);
  const incomingCompanyNorm = normalizeCompanyName(incoming.company);

  // Level 1: Exact Canonical URL Match
  const exactMatch = existingJobs.find(
    j => canonicalizeUrl(j.canonicalUrl) === incomingCanonical
  );

  if (exactMatch) {
    return {
      isExactUrlMatch: true,
      isPossibleDuplicate: false,
      matchedJobId: exactMatch.id,
      matchedJobTitle: exactMatch.title,
      confidenceScore: 1.0,
      reason: `Level 1 Exact URL Match: Canonical URL matches existing job #${exactMatch.id}`
    };
  }

  // Level 2: Possible Duplicate (Same normalized company AND high title similarity)
  for (const existing of existingJobs) {
    const existingCompanyNorm = normalizeCompanyName(existing.company);
    
    if (incomingCompanyNorm && existingCompanyNorm && (incomingCompanyNorm === existingCompanyNorm || incomingCompanyNorm.includes(existingCompanyNorm) || existingCompanyNorm.includes(incomingCompanyNorm))) {
      const similarity = calculateTitleSimilarity(incoming.title, existing.title);
      if (similarity >= 0.6) { // High overlap in core title terms
        return {
          isExactUrlMatch: false,
          isPossibleDuplicate: true,
          matchedJobId: existing.id,
          matchedJobTitle: existing.title,
          confidenceScore: Math.round(similarity * 100) / 100,
          reason: `Level 2 Fuzzy Match: Extracted company '${incoming.company}' matches '${existing.company}' with title similarity ${Math.round(similarity * 100)}%`
        };
      }
    }
  }

  // Level 3: Clean New Job
  return {
    isExactUrlMatch: false,
    isPossibleDuplicate: false,
    confidenceScore: 0,
    reason: 'Clean new job - no canonical URL or company/title collision'
  };
}
