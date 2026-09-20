import Parser from 'rss-parser';
import { checkJobDeduplication } from './dedup';
import { passesDeterministicGate, evaluateWithHeuristics } from './ai-evaluator';
import { loadCandidateProfile } from './storage';

export type AtsType =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'smartrecruiters'
  | 'workable'
  | 'recruitee'
  | 'hn'
  | 'rss'
  | 'tokyodev'
  | 'japandev'
  | 'broadcast';

export interface RawJobPosting {
  externalId: string;
  company: string;
  title: string;
  location: string;
  applyUrl: string;
  contentHtml?: string;
  postedAt?: string;
  updatedAt?: string;
  source: string;
  channelType?: 'ats' | 'rss' | 'broadcast';
}

export type JobPosting = RawJobPosting;

export interface PossibleDuplicateInfo {
  matchedJobId: string;
  matchedJobTitle: string;
  confidenceScore: number;
  reason: string;
}

export interface EvaluatedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  score: number;
  tier?: 'tier_a' | 'tier_b' | 'tier_c';
  gateReason?: string | null;
  locationClass?: string;
  subScores?: {
    roleFit: number;
    stackOverlap: number;
    reachability: number;
    domainAffinity: number;
    freshness: number;
    compFit: number;
    companySignal: number;
    totalScore: number;
    tier: string;
  } | null;
  salary: string;
  sponsorship: 'explicit' | 'possible' | 'unconfirmed';
  isRemote: boolean;
  matchReason: string;
  evidence: string[];
  strengths?: string[];
  concerns?: string[];
  techStack: string[];
  postedAgo: string;
  source: string;
  channelType?: 'ats' | 'rss' | 'broadcast';
  canonicalUrl: string;
  status: 'open' | 'closed' | 'possible_duplicate';
  possibleDuplicateOf?: PossibleDuplicateInfo;
  firstSeenAt: string;
  lastSeenAt: string;
  isNewInCurrentScan?: boolean;
  sourcesCount?: number;
  extractedCompanyName?: string;
}

// Approved Watchlist Employers
export const WATCHLIST_COMPANIES = [
  { name: 'Stripe', ats: 'greenhouse' as AtsType, slug: 'stripe' },
  { name: 'Anthropic', ats: 'lever' as AtsType, slug: 'anthropic' },
  { name: 'Akamai', ats: 'greenhouse' as AtsType, slug: 'akamai' },
  { name: 'Figma', ats: 'lever' as AtsType, slug: 'figma' },
  { name: 'Datadog', ats: 'greenhouse' as AtsType, slug: 'datadog' },
  { name: 'Vercel', ats: 'greenhouse' as AtsType, slug: 'vercel' },
  { name: 'OpenAI', ats: 'greenhouse' as AtsType, slug: 'openai' },
  { name: 'Airbnb', ats: 'greenhouse' as AtsType, slug: 'airbnb' },
];

const rssParser = new Parser({
  customFields: {
    item: [
      ['region', 'region'],
      ['location', 'location'],
      ['country', 'country'],
      ['dc:creator', 'creator'],
    ],
  },
});

/**
 * Calculates human-readable "posted N days ago" from ISO dates (F15)
 */
export function formatPostedAgo(postedAt?: string, fallbackTimestamp?: string): string {
  const targetDateStr = postedAt || fallbackTimestamp;
  if (!targetDateStr) return 'Recently';

  const diffMs = Date.now() - new Date(targetDateStr).getTime();
  if (isNaN(diffMs)) return 'Recently';

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  return `${diffDays}d ago`;
}

export async function fetchRssJobs(feedUrl: string, sourceName: string): Promise<RawJobPosting[]> {
  try {
    const feed = await rssParser.parseURL(feedUrl);
    return (feed.items || []).map((item, idx) => {
      // Extract author or parse title like "Stripe: Senior Backend Engineer"
      let company = item.creator || (item as any).author || '';
      let title = item.title || 'Senior Software Role';
      
      if (!company && title.includes(':')) {
        const parts = title.split(':');
        company = parts[0].trim();
        title = parts.slice(1).join(':').trim();
      }
      if (!company) {
        company = sourceName.replace(/\(.*\)/, '').trim();
      }

      // F10 Fix: Read region/country fields if present in feed, otherwise mark unknown (never 'Remote / Global')
      const rawLocation = (item as any).region || (item as any).location || (item as any).country || '';
      const location = rawLocation.trim() || 'unknown';

      return {
        externalId: item.guid || item.link || `rss-${idx}`,
        company,
        title,
        location,
        applyUrl: item.link || feedUrl,
        contentHtml: item.contentSnippet || item.content || '',
        postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : undefined,
        source: sourceName,
        channelType: 'rss',
      };
    });
  } catch (err) {
    console.error(`Failed to fetch RSS feed ${feedUrl}:`, err);
    return [];
  }
}

export async function fetchCompanyJobs(
  companyName: string,
  ats: AtsType,
  slug: string
): Promise<RawJobPosting[]> {
  try {
    if (ats === 'greenhouse') {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, { 
        cache: 'no-store',
        headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Candidate-Discovery)' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs || []).map((j: any) => ({
        externalId: String(j.id),
        company: companyName,
        title: j.title,
        location: j.location?.name || 'Remote / Unstated',
        applyUrl: j.absolute_url,
        contentHtml: j.content || '',
        postedAt: j.first_published || j.updated_at || undefined,
        updatedAt: j.updated_at,
        source: `Greenhouse ATS (${companyName})`,
        channelType: 'ats',
      }));
    } else if (ats === 'lever') {
      const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, { 
        cache: 'no-store',
        headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Candidate-Discovery)' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((j: any) => ({
        externalId: String(j.id),
        company: companyName,
        title: j.text,
        location: j.categories?.location || j.workplaceType || 'Remote',
        applyUrl: j.hostedUrl,
        contentHtml: j.descriptionPlain || j.additionalPlain || '',
        postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
        source: `Lever ATS (${companyName})`,
        channelType: 'ats',
      }));
    } else if (ats === 'smartrecruiters') {
      const res = await fetch(`https://api.smartrecruiters.com/v1/companies/${slug}/postings`, { 
        cache: 'no-store',
        headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Candidate-Discovery)' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.content || []).map((j: any) => ({
        externalId: String(j.id),
        company: companyName,
        title: j.name,
        location: j.location ? `${j.location.city || ''}, ${j.location.country || ''}` : 'Remote',
        applyUrl: `https://jobs.smartrecruiters.com/${slug}/${j.id}`,
        source: `SmartRecruiters ATS (${companyName})`,
        channelType: 'ats',
      }));
    } else if (ats === 'ashby') {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
        cache: 'no-store',
        headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Candidate-Discovery)' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.jobs || []).map((j: any) => ({
        externalId: String(j.id),
        company: companyName,
        title: j.title,
        location: j.location || (j.isRemote ? 'Remote' : 'Unstated'),
        applyUrl: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${slug}/${j.id}`,
        contentHtml: j.descriptionPlain || j.descriptionHtml || '',
        postedAt: j.publishedAt ? new Date(j.publishedAt).toISOString() : undefined,
        source: `Ashby ATS (${companyName})`,
        channelType: 'ats',
      }));
    } else if (ats === 'workable') {
      return await fetchWorkableJobs(slug, companyName);
    } else if (ats === 'recruitee') {
      return await fetchRecruiteeJobs(slug, companyName);
    } else if (ats === 'hn') {
      return await fetchHnJobs();
    } else if (ats === 'tokyodev' || ats === 'japandev') {
      return await fetchJapanKoreaJobs(ats, companyName);
    }
  } catch (err) {
    console.error(`Failed to fetch live jobs for ${companyName} via ${ats}:`, err);
  }

  return [];
}

export async function fetchWorkableJobs(slug: string, companyName: string): Promise<RawJobPosting[]> {
  try {
    const res = await fetch(`https://apply.workable.com/api/v1/widget/accounts/${slug}`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Candidate-Discovery)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const jobsList = data.jobs || [];
    return jobsList.map((j: any) => ({
      externalId: String(j.shortcode || j.id),
      company: data.name || companyName,
      title: j.title,
      location: j.telecommuting ? 'Remote' : (j.city ? `${j.city}, ${j.country || ''}` : (j.country || 'Remote')),
      applyUrl: j.url || `https://apply.workable.com/${slug}/j/${j.shortcode}/`,
      contentHtml: j.description || `${j.title} at ${companyName}`,
      postedAt: j.created_at ? new Date(j.created_at).toISOString() : undefined,
      source: `Workable ATS (${companyName})`,
      channelType: 'ats',
    }));
  } catch (err: any) {
    console.error(`Failed fetching Workable jobs for ${companyName}:`, err.message);
    return [];
  }
}

export async function fetchRecruiteeJobs(slug: string, companyName: string): Promise<RawJobPosting[]> {
  try {
    const res = await fetch(`https://${slug}.recruitee.com/api/offers/`, {
      cache: 'no-store',
      headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Candidate-Discovery)' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const offers = data.offers || [];
    return offers.map((j: any) => ({
      externalId: String(j.id),
      company: companyName,
      title: j.title,
      location: j.remote ? 'Remote' : (j.location || j.city || 'Remote'),
      applyUrl: j.careers_url || `https://${slug}.recruitee.com/o/${j.slug || j.id}`,
      contentHtml: j.description || `${j.title} at ${companyName}`,
      postedAt: j.published_at ? new Date(j.published_at).toISOString() : undefined,
      source: `Recruitee ATS (${companyName})`,
      channelType: 'ats',
    }));
  } catch (err: any) {
    console.error(`Failed fetching Recruitee jobs for ${companyName}:`, err.message);
    return [];
  }
}

export async function fetchHnJobs(): Promise<RawJobPosting[]> {
  try {
    const searchRes = await fetch(
      'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=Who%20is%20hiring&hitsPerPage=1',
      { signal: AbortSignal.timeout(6000) }
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const story = searchData.hits?.[0];
    if (!story || !story.objectID) return [];

    const commentsRes = await fetch(
      `https://hn.algolia.com/api/v1/search?tags=comment,story_${story.objectID}&hitsPerPage=50`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!commentsRes.ok) return [];
    const commentsData = await commentsRes.json();

    const postings: RawJobPosting[] = [];
    for (const c of commentsData.hits || []) {
      const text = c.comment_text || '';
      if (!text || text.length < 50) continue;

      const lines = text.split(/<p>|\n/);
      const header = lines[0].replace(/<[^>]+>/g, '').trim();
      const parts = header.split('|').map((p: string) => p.trim());

      const company = parts[0] || 'Tech Startup';
      const title = parts[1] || 'Software Engineer';
      const location = parts[2] || (text.toLowerCase().includes('remote') ? 'Remote' : 'Unknown');

      postings.push({
        externalId: String(c.objectID),
        company: company.slice(0, 50),
        title: title.slice(0, 70),
        location: location.slice(0, 80),
        applyUrl: `https://news.ycombinator.com/item?id=${c.objectID}`,
        contentHtml: text,
        postedAt: c.created_at ? new Date(c.created_at).toISOString() : undefined,
        source: 'Hacker News (Who is Hiring)',
        channelType: 'ats',
      });
    }

    return postings;
  } catch (err: any) {
    console.error('Failed fetching Hacker News Who is Hiring:', err.message);
    return [];
  }
}

export async function fetchJapanKoreaJobs(type: 'tokyodev' | 'japandev', companyName: string): Promise<RawJobPosting[]> {
  const feedUrl = type === 'tokyodev'
    ? 'https://www.tokyodev.com/jobs.rss'
    : 'https://japan-dev.com/rss.xml';
  return await fetchRssJobs(feedUrl, companyName || (type === 'tokyodev' ? 'TokyoDev' : 'Japan Dev'));
}

export function evaluateRawJob(
  raw: RawJobPosting, 
  existingJobsPool: EvaluatedJob[] = [],
  scanTimestamp: string = new Date().toISOString()
): EvaluatedJob | null {
  const titleLower = raw.title.toLowerCase();
  const locationLower = raw.location.toLowerCase();
  const contentLower = (raw.contentHtml || '').toLowerCase();

  // Stage 1: Deterministic Gate Exclusion
  if (!passesDeterministicGate(raw)) {
    return null;
  }

  // Run Two-Tier Deduplication Check
  const dedupCheck = checkJobDeduplication(
    { company: raw.company, title: raw.title, applyUrl: raw.applyUrl },
    existingJobsPool
  );

  // Level 1: Exact URL match -> merge source with existing job
  if (dedupCheck.isExactUrlMatch && dedupCheck.matchedJobId) {
    const existing = existingJobsPool.find(j => j.id === dedupCheck.matchedJobId);
    if (existing) {
      existing.lastSeenAt = scanTimestamp;
      if (!existing.source.includes(raw.source)) {
        existing.source = `${existing.source} + ${raw.source}`;
        existing.evidence.push(`Multi-Source Corroboration: Also detected via ${raw.source}`);
        existing.sourcesCount = (existing.sourcesCount || 1) + 1;
      }
      return null; // Merged into existing job object in place
    }
  }

  let profile;
  try {
    profile = loadCandidateProfile();
  } catch (e) {
    profile = {
      candidate: { name: 'Candidate', yearsOfExperience: 8.5, currentCompany: 'Amdocs', currentTitle: 'Software Engineer (Advanced)' }
    } as any;
  }

  const evalResult = evaluateWithHeuristics(raw, profile);
  const { score, matchReason, evidenceQuotes, techStack, sponsorship, isRemote, salary } = evalResult;

  // Level 2: Flag as possible duplicate if high company + title overlap
  let status: 'open' | 'closed' | 'possible_duplicate' = 'open';
  let possibleDuplicateOf: PossibleDuplicateInfo | undefined = undefined;
  const evidence = [...evidenceQuotes];

  if (dedupCheck.isPossibleDuplicate && dedupCheck.matchedJobId) {
    status = 'possible_duplicate';
    possibleDuplicateOf = {
      matchedJobId: dedupCheck.matchedJobId,
      matchedJobTitle: dedupCheck.matchedJobTitle || 'Existing ATS Job',
      confidenceScore: dedupCheck.confidenceScore,
      reason: dedupCheck.reason || 'High company & title similarity with tracked ATS posting'
    };
    evidence.push(`⚠️ Possible Duplicate: Matches tracked posting #${dedupCheck.matchedJobId} (${dedupCheck.reason})`);
  }

  const jobId = `live-${raw.company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${raw.externalId.replace(/[^a-z0-9]/g, '')}`;

  return {
    id: jobId,
    title: raw.title,
    company: raw.company,
    location: raw.location,
    score,
    salary,
    sponsorship,
    isRemote,
    matchReason,
    evidence,
    techStack,
    postedAgo: raw.postedAt ? new Date(raw.postedAt).toLocaleDateString() : 'Live Ingestion',
    source: raw.source,
    channelType: raw.channelType || 'ats',
    canonicalUrl: raw.applyUrl,
    status,
    possibleDuplicateOf,
    firstSeenAt: scanTimestamp,
    lastSeenAt: scanTimestamp,
    isNewInCurrentScan: true,
    sourcesCount: 1,
    extractedCompanyName: raw.company,
  };
}
