import * as cheerio from 'cheerio';
import { RawJobPosting, EvaluatedJob } from './ats-adapters';
import { loadCandidateProfile, loadCanonicalJobs, saveCanonicalJobs } from './storage';
import { evaluateJobWithLLM, AiEvaluationResult } from './ai-evaluator';

export interface UrlEvaluationResponse {
  success: boolean;
  rawPosting?: RawJobPosting;
  evaluation?: AiEvaluationResult;
  evaluatedJob?: EvaluatedJob;
  saved?: boolean;
  error?: string;
}

/**
 * Extracts company name cleanly from URL hostname or title
 */
function extractCompanyFromUrl(url: URL, pageTitle?: string): string {
  const hostname = url.hostname.toLowerCase();
  
  // Specific ATS domains
  if (hostname.includes('greenhouse.io') || hostname.includes('lever.co') || hostname.includes('ashbyhq.com') || hostname.includes('smartrecruiters.com')) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      const slug = parts[0];
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    }
  }

  // Domain name fallback (e.g., careers.stripe.com -> Stripe)
  const hostParts = hostname.replace(/^www\./, '').split('.');
  if (hostParts.length >= 2) {
    const mainDomain = hostParts[hostParts.length - 2];
    if (!['com', 'co', 'io', 'org', 'net', 'app', 'ai', 'careers', 'jobs'].includes(mainDomain)) {
      return mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1);
    }
  }

  if (pageTitle && pageTitle.includes(' at ')) {
    const splitAt = pageTitle.split(' at ');
    return splitAt[splitAt.length - 1].trim();
  }

  return 'Target Employer';
}

/**
 * Clean HTML and extract text content using Cheerio
 */
function cleanHtmlContent($: cheerio.CheerioAPI): string {
  // Remove scripts, styles, navigation, footer, forms
  $('script, style, noscript, iframe, nav, footer, header, form, svg').remove();

  // Try to find the most relevant job description container
  const selectors = [
    '[data-qa="job-description"]',
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    '[class*="description"]',
    '[id*="job-description"]',
    '[id*="description"]',
    'article',
    'main',
    '[role="main"]',
    '.content',
    '#content'
  ];

  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().replace(/\s+/g, ' ').trim();
      if (text.length > 200) {
        return text;
      }
    }
  }

  return $('body').text().replace(/\s+/g, ' ').trim();
}

/**
 * Ingests a job from any URL: specialized ATS endpoints or general HTML scraper
 */
export async function fetchJobFromUrl(targetUrl: string): Promise<RawJobPosting> {
  const parsedUrl = new URL(targetUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;

  // 1. Specialized Greenhouse Handler
  if (hostname.includes('greenhouse.io')) {
    // URL pattern: /boards/{slug}/jobs/{id} or /{slug}/jobs/{id}
    const match = pathname.match(/(?:boards\/)?([a-zA-Z0-9_-]+)\/jobs\/([0-9]+)/);
    if (match) {
      const [, slug, jobId] = match;
      try {
        const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${jobId}?content=true`;
        const res = await fetch(apiUrl, {
          headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Job-Evaluator)' },
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          const companyName = slug.charAt(0).toUpperCase() + slug.slice(1);
          const $ = cheerio.load(data.content || '');
          return {
            externalId: String(data.id || jobId),
            company: companyName,
            title: data.title || 'Software Engineering Role',
            location: data.location?.name || 'Remote / Unstated',
            applyUrl: data.absolute_url || targetUrl,
            contentHtml: $.text().replace(/\s+/g, ' ').trim() || data.content || '',
            updatedAt: data.updated_at,
            source: `Greenhouse ATS (${companyName})`,
            channelType: 'ats'
          };
        }
      } catch (err) {
        console.warn('Direct Greenhouse API lookup failed, falling back to universal scraping:', err);
      }
    }
  }

  // 2. Specialized Lever Handler
  if (hostname.includes('lever.co')) {
    // URL pattern: jobs.lever.co/{slug}/{id}
    const match = pathname.match(/\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9-]+)/);
    if (match) {
      const [, slug, jobId] = match;
      try {
        const apiUrl = `https://api.lever.co/v0/postings/${slug}/${jobId}`;
        const res = await fetch(apiUrl, {
          headers: { 'User-Agent': 'JobAppy-Portal/2.0 (Job-Evaluator)' },
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          const companyName = slug.charAt(0).toUpperCase() + slug.slice(1);
          return {
            externalId: String(data.id || jobId),
            company: companyName,
            title: data.text || 'Engineering Role',
            location: data.categories?.location || data.workplaceType || 'Remote',
            applyUrl: data.hostedUrl || targetUrl,
            contentHtml: (data.descriptionPlain || '') + ' ' + (data.additionalPlain || ''),
            postedAt: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
            source: `Lever ATS (${companyName})`,
            channelType: 'ats'
          };
        }
      } catch (err) {
        console.warn('Direct Lever API lookup failed, falling back to universal scraping:', err);
      }
    }
  }

  // 3. Universal Web HTML Scraper with Cheerio
  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL (${res.status} ${res.statusText})`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Extract Title
  let title = $('meta[property="og:title"]').attr('content') ||
              $('meta[name="twitter:title"]').attr('content') ||
              $('h1').first().text().trim() ||
              $('title').text().trim() ||
              'Software Engineering Opening';

  // Clean title if formatted like "Role - Company" or "Role | Company"
  if (title.includes(' | ')) {
    title = title.split(' | ')[0].trim();
  } else if (title.includes(' - ')) {
    title = title.split(' - ')[0].trim();
  }

  // Extract Company
  let company = $('meta[property="og:site_name"]').attr('content') ||
                $('meta[name="author"]').attr('content') ||
                extractCompanyFromUrl(parsedUrl, $('title').text().trim());

  // Extract Location
  let location = $('meta[name="job_location"]').attr('content') ||
                 $('[class*="location"]').first().text().trim() ||
                 'Remote / Location Unstated';
  if (location.length > 50) {
    location = 'Remote / Hybrid';
  }

  const cleanText = cleanHtmlContent($);

  return {
    externalId: `url-${Buffer.from(targetUrl).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
    company,
    title,
    location,
    applyUrl: targetUrl,
    contentHtml: cleanText.slice(0, 6000),
    source: `Direct URL (${company})`,
    channelType: 'broadcast'
  };
}

/**
 * Evaluates a single job URL against candidate profile
 */
export async function evaluateTargetJobUrl(
  targetUrl: string,
  saveToJobs: boolean = false
): Promise<UrlEvaluationResponse> {
  try {
    const raw = await fetchJobFromUrl(targetUrl);
    const profile = loadCandidateProfile();
    const evaluation = await evaluateJobWithLLM(raw, profile);

    const evaluatedJob: EvaluatedJob = {
      id: `manual-${raw.company.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
      title: raw.title,
      company: raw.company,
      location: raw.location,
      score: evaluation.score,
      salary: evaluation.salary || 'Salary not stated',
      sponsorship: evaluation.sponsorship,
      isRemote: evaluation.isRemote,
      matchReason: evaluation.matchReason,
      evidence: evaluation.evidenceQuotes.length > 0 ? evaluation.evidenceQuotes : [
        `Candidate Seniority match for ${profile.candidate.yearsOfExperience}+ years experience.`,
        `Tech alignment: ${evaluation.techStack.join(', ')}.`
      ],
      techStack: evaluation.techStack,
      postedAgo: 'Manual Evaluation',
      source: raw.source,
      channelType: raw.channelType || 'broadcast',
      canonicalUrl: raw.applyUrl,
      status: 'open',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      isNewInCurrentScan: true,
      sourcesCount: 1,
      extractedCompanyName: raw.company
    };

    let saved = false;
    if (saveToJobs) {
      const existingJobs = loadCanonicalJobs();
      // Check if already exists by canonical URL
      const existsIndex = existingJobs.findIndex(j => j.canonicalUrl === evaluatedJob.canonicalUrl);
      if (existsIndex >= 0) {
        existingJobs[existsIndex] = { ...existingJobs[existsIndex], ...evaluatedJob, id: existingJobs[existsIndex].id };
      } else {
        existingJobs.unshift(evaluatedJob);
      }
      saveCanonicalJobs(existingJobs);
      saved = true;
    }

    return {
      success: true,
      rawPosting: raw,
      evaluation,
      evaluatedJob,
      saved
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to evaluate job URL'
    };
  }
}
