import { AtsType } from './ats-adapters';

export interface AtsDetectionResult {
  ats: AtsType;
  slug: string;
  companyName: string;
  confirmedJobCount?: number;
  careersUrl?: string;
}

function cleanCompanyName(slug: string): string {
  // Convert slug to Title Case: "acme-corp" -> "Acme Corp"
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Parses direct ATS links from URL structure
 */
export function parseAtsFromUrl(rawUrl: string): AtsDetectionResult | null {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // Greenhouse
    if (hostname === 'boards.greenhouse.io' || hostname === 'boards.eu.greenhouse.io' || hostname === 'job-boards.greenhouse.io') {
      const parts = pathname.split('/').filter(Boolean);
      const slug = parts[0] === 'embed' ? parsed.searchParams.get('for') || parts[1] : parts[0];
      if (slug) {
        return { ats: 'greenhouse', slug, companyName: cleanCompanyName(slug) };
      }
    }

    // Lever
    if (hostname === 'jobs.lever.co') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0]) {
        return { ats: 'lever', slug: parts[0], companyName: cleanCompanyName(parts[0]) };
      }
    }

    // Ashby
    if (hostname === 'jobs.ashbyhq.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0]) {
        return { ats: 'ashby', slug: parts[0], companyName: cleanCompanyName(parts[0]) };
      }
    }

    // SmartRecruiters
    if (hostname === 'jobs.smartrecruiters.com' || hostname === 'careers.smartrecruiters.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0]) {
        return { ats: 'smartrecruiters', slug: parts[0], companyName: cleanCompanyName(parts[0]) };
      }
    }

    // Workable
    if (hostname === 'apply.workable.com') {
      const parts = pathname.split('/').filter(Boolean);
      if (parts[0]) {
        return { ats: 'workable', slug: parts[0], companyName: cleanCompanyName(parts[0]) };
      }
    }

    // Recruitee
    if (hostname.endsWith('.recruitee.com')) {
      const slug = hostname.replace('.recruitee.com', '').split('.')[0];
      if (slug && slug !== 'api' && slug !== 'auth') {
        return { ats: 'recruitee', slug, companyName: cleanCompanyName(slug) };
      }
    }
  } catch {
    // Malformed URL
  }

  return null;
}

/**
 * Inspects HTML content of a careers page for embedded ATS widgets or links
 */
export function parseAtsFromHtml(html: string, pageUrl?: string): AtsDetectionResult | null {
  // 1. Check for Greenhouse iframe / links
  const ghMatch =
    html.match(/boards(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=|)([a-zA-Z0-9_\-]+)/i) ||
    html.match(/job-boards\.greenhouse\.io\/([a-zA-Z0-9_\-]+)/i);
  if (ghMatch && ghMatch[1] && ghMatch[1].toLowerCase() !== 'embed') {
    const slug = ghMatch[1];
    return { ats: 'greenhouse', slug, companyName: cleanCompanyName(slug) };
  }

  // 2. Check for Lever links or widgets
  const leverMatch =
    html.match(/jobs\.lever\.co\/([a-zA-Z0-9_\-]+)/i) ||
    html.match(/api\.lever\.co\/v0\/postings\/([a-zA-Z0-9_\-]+)/i) ||
    html.match(/data-lever-account=["']([a-zA-Z0-9_\-]+)["']/i);
  if (leverMatch && leverMatch[1]) {
    const slug = leverMatch[1];
    return { ats: 'lever', slug, companyName: cleanCompanyName(slug) };
  }

  // 3. Check for Ashby embeds / links
  const ashbyMatch =
    html.match(/jobs\.ashbyhq\.com\/([a-zA-Z0-9_\-]+)/i) ||
    html.match(/api\.ashbyhq\.com\/posting-api\/job-board\/([a-zA-Z0-9_\-]+)/i) ||
    html.match(/ashby-job-board-url=["'].*?jobs\.ashbyhq\.com\/([a-zA-Z0-9_\-]+)/i);
  if (ashbyMatch && ashbyMatch[1]) {
    const slug = ashbyMatch[1];
    return { ats: 'ashby', slug, companyName: cleanCompanyName(slug) };
  }

  // 4. Check for Workable embeds / links
  const workableMatch =
    html.match(/apply\.workable\.com\/([a-zA-Z0-9_\-]+)/i) ||
    html.match(/www\.workable\.com\/api\/accounts\/([a-zA-Z0-9_\-]+)/i);
  if (workableMatch && workableMatch[1]) {
    const slug = workableMatch[1];
    return { ats: 'workable', slug, companyName: cleanCompanyName(slug) };
  }

  // 5. Check for Recruitee embeds / links
  const recruiteeMatch = html.match(/([a-zA-Z0-9_\-]+)\.recruitee\.com/i);
  if (recruiteeMatch && recruiteeMatch[1] && !['www', 'api', 'app', 'cdn'].includes(recruiteeMatch[1])) {
    const slug = recruiteeMatch[1];
    return { ats: 'recruitee', slug, companyName: cleanCompanyName(slug) };
  }

  // 6. Check for SmartRecruiters links
  const srMatch =
    html.match(/jobs\.smartrecruiters\.com\/([a-zA-Z0-9_\-]+)/i) ||
    html.match(/careers\.smartrecruiters\.com\/([a-zA-Z0-9_\-]+)/i);
  if (srMatch && srMatch[1]) {
    const slug = srMatch[1];
    return { ats: 'smartrecruiters', slug, companyName: cleanCompanyName(slug) };
  }

  return null;
}

/**
 * End-to-end detection: tests URL directly, or fetches HTML and verifies against ATS API
 */
export async function detectAtsFromUrl(targetUrl: string): Promise<AtsDetectionResult | null> {
  const direct = parseAtsFromUrl(targetUrl);
  if (direct) {
    direct.careersUrl = targetUrl;
    return direct;
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return null;
    }

    const html = await res.text();
    const detected = parseAtsFromHtml(html, targetUrl);
    if (detected) {
      detected.careersUrl = targetUrl;
      return detected;
    }
  } catch (err: any) {
    console.warn(`[ATS Detector] Could not inspect HTML for ${targetUrl}:`, err.message);
  }

  return null;
}
