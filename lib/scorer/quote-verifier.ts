import { ExtractedJobFacts } from './types';

/**
 * Normalizes text for verbatim substring comparison:
 * Replaces all whitespace sequences (tabs, newlines, non-breaking spaces) with a single ASCII space,
 * trims edges, and lowercases.
 */
export function normalizeForSearch(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/[\s\u00A0]+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Validates whether a candidate quote is a verbatim substring of any of the source texts
 * (job description, title, or location string) after whitespace and case normalization.
 */
export function isVerbatimSubstring(
  quote: string | null | undefined,
  sourceTexts: Array<string | null | undefined>
): boolean {
  if (!quote) return false;
  const normalizedQuote = normalizeForSearch(quote);
  if (!normalizedQuote || normalizedQuote.length < 2) return false;

  for (const src of sourceTexts) {
    if (!src) continue;
    const normalizedSrc = normalizeForSearch(src);
    if (normalizedSrc.includes(normalizedQuote)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifies all extracted facts against the verbatim source texts (JD, title, location).
 * Enforces Zero-Fabrication Rule: drops any extracted fact whose supporting quote
 * is not a verbatim substring of the source texts.
 */
export function verifyExtractedFacts(
  rawFacts: ExtractedJobFacts,
  sourceTexts: {
    jdText?: string | null;
    title?: string | null;
    location?: string | null;
  }
): ExtractedJobFacts {
  const sources = [sourceTexts.jdText, sourceTexts.title, sourceTexts.location];
  const combinedSource = sources.filter(Boolean).join(' ');
  const normalizedCombined = normalizeForSearch(combinedSource);

  const quotes = { ...rawFacts.quotes };
  const verified: ExtractedJobFacts = {
    ...rawFacts,
    quotes,
  };

  // 1. Remote Scope
  if (verified.remoteScope !== 'unknown') {
    const q = quotes.remoteScope;
    if (!isVerbatimSubstring(q, sources)) {
      verified.remoteScope = 'unknown';
      quotes.remoteScope = null;
    }
  }

  // 2. Allowed Countries
  verified.allowedCountries = (verified.allowedCountries || []).filter((country) => {
    const itemQuote = quotes[`allowedCountry:${country}`] || quotes.allowedCountries;
    if (isVerbatimSubstring(itemQuote, sources)) return true;
    // Fallback: country name itself must appear verbatim as word boundary
    const countryPattern = new RegExp(`\\b${country.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return countryPattern.test(combinedSource);
  });

  // 3. Excluded Countries
  verified.excludedCountries = (verified.excludedCountries || []).filter((country) => {
    const itemQuote = quotes[`excludedCountry:${country}`] || quotes.excludedCountries;
    if (isVerbatimSubstring(itemQuote, sources)) return true;
    const countryPattern = new RegExp(`\\b${country.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return countryPattern.test(combinedSource);
  });

  // 4. Timezone Overlap
  if (verified.tzOverlap) {
    const q = quotes.tzOverlap;
    if (!isVerbatimSubstring(q, sources)) {
      verified.tzOverlap = null;
      quotes.tzOverlap = null;
    }
  }

  // 5. Engagement (Employee / Contractor / EOR)
  if (verified.engagement !== 'unknown') {
    const q = quotes.engagement;
    if (!isVerbatimSubstring(q, sources)) {
      verified.engagement = 'unknown';
      quotes.engagement = null;
    }
  }

  // 6. Salary
  if (verified.salary) {
    const q = quotes.salary;
    if (!isVerbatimSubstring(q, sources)) {
      verified.salary = null;
      quotes.salary = null;
    }
  }

  // 7. Visa Sponsorship
  if (verified.visaSponsorship !== 'unknown') {
    const q = quotes.visaSponsorship;
    if (!isVerbatimSubstring(q, sources)) {
      verified.visaSponsorship = 'unknown';
      quotes.visaSponsorship = null;
    }
  }

  // 8. Seniority
  if (verified.seniority !== 'unknown') {
    const q = quotes.seniority;
    if (!isVerbatimSubstring(q, sources)) {
      verified.seniority = 'unknown';
      quotes.seniority = null;
    }
  }

  // 9. Years Required
  if (verified.yearsRequired !== null && verified.yearsRequired !== undefined) {
    const q = quotes.yearsRequired;
    if (!isVerbatimSubstring(q, sources)) {
      verified.yearsRequired = null;
      quotes.yearsRequired = null;
    }
  }

  // 10. Tech Stack - Must-Have & Nice-To-Have
  // Tech item is kept only if its quote is verbatim OR the tech keyword itself appears verbatim in source
  verified.mustHaveTech = (verified.mustHaveTech || []).filter((tech) => {
    const itemQuote = quotes[`tech:${tech}`] || quotes.mustHaveTech;
    if (isVerbatimSubstring(itemQuote, sources)) return true;
    const techPattern = new RegExp(`\\b${tech.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return techPattern.test(combinedSource);
  });

  verified.niceToHaveTech = (verified.niceToHaveTech || []).filter((tech) => {
    const itemQuote = quotes[`tech:${tech}`] || quotes.niceToHaveTech;
    if (isVerbatimSubstring(itemQuote, sources)) return true;
    const techPattern = new RegExp(`\\b${tech.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return techPattern.test(combinedSource);
  });

  // 11. Domain Tags
  verified.domainTags = (verified.domainTags || []).filter((tag) => {
    const tagQuote = quotes[`domain:${tag}`] || quotes.domainTags;
    if (isVerbatimSubstring(tagQuote, sources)) return true;
    const tagPattern = new RegExp(`\\b${tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    return tagPattern.test(combinedSource);
  });

  // 12. Presales Flag
  if (verified.presales) {
    const q = quotes.presales;
    const titleIsPresales = /\b(pre-sales|presales|partner\s+architect|sales\s+engineer(ing)?|solutions\s+consultant)\b/i.test(sourceTexts.title || '');
    if (!isVerbatimSubstring(q, sources) && !titleIsPresales) {
      verified.presales = false;
      quotes.presales = null;
    }
  }

  return verified;
}
