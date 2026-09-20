/**
 * Deduplication & Canonicalization Utilities for Job Ingestion Pipeline
 */

export interface JobLocationInfo {
  raw: string;
  normalizedCity?: string;
  country?: string;
  isRemote?: boolean;
}

/**
 * Normalizes URLs to canonical form:
 * - Strips marketing & analytics tracking parameters
 * - Retains gh_jid (Greenhouse Job ID on company-hosted portals, e.g. Stripe)
 * - Removes trailing slashes and lowercases hostname
 */
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Strip ONLY true tracking & session params (F1: DO NOT strip gh_jid)
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'lever-origin', 'ref', 'source', 'gh_src', 'fbclid', 'gclid', '_ga',
      'trk', 'tracking_id', 'candidate_source'
    ];

    trackingParams.forEach(param => parsed.searchParams.delete(param));

    // Normalize path trailing slash
    let cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath) cleanPath = '/';

    // Sort remaining query params deterministically
    parsed.searchParams.sort();
    const query = parsed.searchParams.toString();

    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${cleanPath}${query ? `?${query}` : ''}`;
  } catch (e) {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Constructs a globally unique, stable identity key for an opening
 */
export function createJobIdentity(ats: string, slug: string, externalId: string): string {
  return `${ats.toLowerCase().trim()}:${slug.toLowerCase().trim()}:${externalId.toString().trim()}`;
}

/**
 * Normalize company names for fuzzy comparison (e.g. "Stripe, Inc." -> "stripe")
 */
export function normalizeCompanyName(company: string): string {
  return (company || '')
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|ltd|limited|llc|co|plc|technologies|solutions|group|gmbh)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Normalizes a location string into comparable tokens
 */
export function normalizeLocation(location: string): {
  normalized: string;
  isRemote: boolean;
  tokens: Set<string>;
} {
  const locLower = (location || '').toLowerCase();
  const isRemote = locLower.includes('remote') || locLower.includes('worldwide') || locLower.includes('anywhere');

  const tokens = new Set(
    locLower
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && w !== 'remote' && w !== 'hybrid' && w !== 'onsite')
  );

  return {
    normalized: Array.from(tokens).sort().join(' '),
    isRemote,
    tokens,
  };
}

/**
 * Normalizes job title for title similarity comparison
 * CRITICAL (F11): Seniority tokens (senior, staff, principal, lead) are PRESERVED!
 */
export function normalizeJobTitle(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // remove parentheticals like (f/m/d) or (Remote)
    .replace(/\[.*?\]/g, '') // remove brackets like [Bangalore]
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaccard word similarity between two titles (0.0 to 1.0)
 * Retains seniority and specialization tokens
 */
export function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = new Set(normalizeJobTitle(title1).split(' ').filter(w => w.length > 1));
  const words2 = new Set(normalizeJobTitle(title2).split(' ').filter(w => w.length > 1));

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

export interface DedupCandidateJob {
  id?: string;
  ats?: string;
  slug?: string;
  externalId?: string;
  company: string;
  title: string;
  applyUrl?: string;
  canonicalUrl?: string;
  location?: string;
}

/**
 * Perform Two-Tier Deduplication check against an existing set of jobs
 * F11 Fix: Checks location compatibility & retains seniority in title similarity
 */
export function checkJobDeduplication(
  incoming: DedupCandidateJob,
  existingJobs: DedupCandidateJob[]
): DedupCheckResult {
  const incomingCanonical = canonicalizeUrl(incoming.applyUrl || incoming.canonicalUrl || '');
  const incomingCompanyNorm = normalizeCompanyName(incoming.company);
  const incomingIdentity = (incoming.ats && incoming.slug && incoming.externalId)
    ? createJobIdentity(incoming.ats, incoming.slug, incoming.externalId)
    : null;
  const incomingLoc = normalizeLocation(incoming.location || '');

  // Level 1: Exact Identity or Exact Canonical URL Match
  const exactMatch = existingJobs.find(j => {
    if (incomingIdentity && j.ats && j.slug && j.externalId) {
      if (createJobIdentity(j.ats, j.slug, j.externalId) === incomingIdentity) {
        return true;
      }
    }
    const existingCanonical = canonicalizeUrl(j.canonicalUrl || j.applyUrl || '');
    return existingCanonical === incomingCanonical;
  });

  if (exactMatch) {
    return {
      isExactUrlMatch: true,
      isPossibleDuplicate: false,
      matchedJobId: exactMatch.id,
      matchedJobTitle: exactMatch.title,
      confidenceScore: 1.0,
      reason: `Level 1 Exact Match: Matches existing job #${exactMatch.id}`
    };
  }

  // Level 2: Fuzzy Duplicate (Same company AND compatible location AND high title similarity)
  for (const existing of existingJobs) {
    const existingCompanyNorm = normalizeCompanyName(existing.company);

    if (
      incomingCompanyNorm &&
      existingCompanyNorm &&
      (incomingCompanyNorm === existingCompanyNorm ||
        incomingCompanyNorm.includes(existingCompanyNorm) ||
        existingCompanyNorm.includes(incomingCompanyNorm))
    ) {
      // Check location compatibility (F11)
      const existingLoc = normalizeLocation(existing.location || '');

      const bothHaveLocationTokens = incomingLoc.tokens.size > 0 && existingLoc.tokens.size > 0;
      let locationsOverlap = false;

      if (bothHaveLocationTokens) {
        for (const token of incomingLoc.tokens) {
          if (existingLoc.tokens.has(token)) {
            locationsOverlap = true;
            break;
          }
        }
      } else {
        // If one or both locations are remote/unspecified, allow comparison
        locationsOverlap = incomingLoc.isRemote || existingLoc.isRemote || (!bothHaveLocationTokens);
      }

      // If locations are explicitly different physical locations, DO NOT flag as duplicate
      if (bothHaveLocationTokens && !locationsOverlap && !incomingLoc.isRemote && !existingLoc.isRemote) {
        continue;
      }

      const similarity = calculateTitleSimilarity(incoming.title, existing.title);

      // Require high similarity (>= 0.75) where seniority tokens must align
      if (similarity >= 0.75) {
        return {
          isExactUrlMatch: false,
          isPossibleDuplicate: true,
          matchedJobId: existing.id,
          matchedJobTitle: existing.title,
          confidenceScore: Math.round(similarity * 100) / 100,
          reason: `Level 2 Fuzzy Match: Company '${incoming.company}' matches '${existing.company}' with title similarity ${Math.round(similarity * 100)}%`
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
