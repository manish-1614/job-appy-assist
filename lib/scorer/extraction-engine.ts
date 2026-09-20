import crypto from 'crypto';
import { sqlite } from '../db';
import { ExtractedJobFacts } from './types';
import { verifyExtractedFacts } from './quote-verifier';
import { classifyRoleFamily } from '../ai-evaluator';

export const PROMPT_VERSION = 'v2.0';

/**
 * Computes SHA-256 hash of text
 */
export function computeHash(text: string): string {
  return crypto.createHash('sha256').update(text || '', 'utf8').digest('hex');
}

/**
 * Loads cached extraction from SQLite if available
 */
export function getCachedExtraction(
  contentHash: string,
  promptVersion: string,
  model: string
): ExtractedJobFacts | null {
  try {
    const row = sqlite
      .prepare(
        'SELECT extracted_json, extraction_status FROM job_extractions WHERE content_hash = ? AND prompt_version = ? AND model = ? LIMIT 1'
      )
      .get(contentHash, promptVersion, model) as { extracted_json: string; extraction_status: string } | undefined;

    if (row && row.extraction_status === 'success' && row.extracted_json) {
      return JSON.parse(row.extracted_json) as ExtractedJobFacts;
    }
  } catch (err) {
    console.warn('[ExtractionEngine] Failed to read cache:', err);
  }
  return null;
}

/**
 * Saves extraction result to SQLite cache
 */
export function saveExtractionCache(params: {
  jobId: string;
  contentHash: string;
  promptVersion: string;
  model: string;
  extractionStatus: 'success' | 'failed';
  extractedJson: string;
  subScoresJson?: string;
  tier?: string;
}): void {
  try {
    const jobExists = sqlite.prepare('SELECT 1 FROM jobs WHERE id = ?').get(params.jobId);
    if (!jobExists) return;

    sqlite
      .prepare(`
        INSERT OR REPLACE INTO job_extractions (
          job_id, content_hash, prompt_version, model, extracted_at,
          extraction_status, extracted_json, sub_scores_json, tier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        params.jobId,
        params.contentHash,
        params.promptVersion,
        params.model,
        new Date().toISOString(),
        params.extractionStatus,
        params.extractedJson,
        params.subScoresJson || null,
        params.tier || 'tier_c'
      );
  } catch (err) {
    console.warn('[ExtractionEngine] Failed to write cache:', err);
  }
}

/**
 * Deterministic offline extractor that extracts facts with strict verbatim quotes from text.
 * Used for offline evaluation harness, tests, and fallback when offline.
 */
export function extractFactsOffline(input: {
  title: string;
  location: string;
  company: string;
  jdText: string;
}): ExtractedJobFacts {
  const { title, location, jdText } = input;
  const fullText = `${title} ${location} ${jdText}`;
  const quotes: Record<string, string | null> = {};

  // 1. Remote Scope & Location
  let remoteScope: ExtractedJobFacts['remoteScope'] = 'unknown';
  const remoteMatch = fullText.match(/\b(worldwide remote|remote worldwide|work from anywhere|anywhere in the world)\b/i);
  if (remoteMatch) {
    remoteScope = 'worldwide';
    quotes.remoteScope = remoteMatch[0];
  } else if (/\b(remote\s*[-–—:]?\s*(india|apac)|(india|apac)\s*remote)\b/i.test(fullText)) {
    const m = fullText.match(/\b(remote\s*[-–—:]?\s*(india|apac)|(india|apac)\s*remote)\b/i);
    remoteScope = 'india';
    quotes.remoteScope = m ? m[0] : null;
  } else if (/\b(remote\s*[-–—:]?\s*(us|usa|united states|emea|europe|uk|canada))\b/i.test(fullText)) {
    const m = fullText.match(/\b(remote\s*[-–—:]?\s*(us|usa|united states|emea|europe|uk|canada))\b/i);
    remoteScope = 'region_locked';
    quotes.remoteScope = m ? m[0] : null;
  } else if (/\b(remote)\b/i.test(location)) {
    remoteScope = 'worldwide';
    quotes.remoteScope = 'remote';
  } else if (/\b(onsite|on-site|office)\b/i.test(fullText)) {
    const m = fullText.match(/\b(onsite|on-site|office)\b/i);
    remoteScope = 'onsite';
    quotes.remoteScope = m ? m[0] : null;
  }

  // 2. Visa Sponsorship
  let visaSponsorship: ExtractedJobFacts['visaSponsorship'] = 'unknown';
  const sponsorMatch = fullText.match(/\b(visa sponsorship (is )?provided|visa sponsorship (is )?available|relocation assistance (is )?provided|relocation provided|will sponsor visa)\b/i);
  if (sponsorMatch) {
    visaSponsorship = 'explicit';
    quotes.visaSponsorship = sponsorMatch[0];
  } else if (/\b(no visa sponsorship|cannot sponsor visas|must have valid work authorization)\b/i.test(fullText)) {
    const m = fullText.match(/\b(no visa sponsorship|cannot sponsor visas|must have valid work authorization)\b/i);
    visaSponsorship = 'none';
    quotes.visaSponsorship = m ? m[0] : null;
  }

  // 3. Salary
  let salary: ExtractedJobFacts['salary'] = null;
  const salaryMatch = fullText.match(/(\$|€|£|INR|USD)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})\s*(?:-|to)\s*(\$|€|£|INR|USD)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,7})/i);
  if (salaryMatch) {
    const currency = salaryMatch[1].replace('$', 'USD').replace('€', 'EUR').replace('£', 'GBP').toUpperCase();
    const minVal = parseInt(salaryMatch[2].replace(/,/g, ''), 10);
    const maxVal = parseInt(salaryMatch[4].replace(/,/g, ''), 10);
    if (!isNaN(maxVal) && maxVal > 0) {
      salary = { min: minVal, max: maxVal, currency, period: 'yearly' };
      quotes.salary = salaryMatch[0];
    }
  }

  // 4. Seniority
  let seniority: ExtractedJobFacts['seniority'] = 'unknown';
  const senMatch = title.match(/\b(staff|principal|lead|architect|senior|sr\.?|junior|entry-level)\b/i);
  if (senMatch) {
    const m = senMatch[1].toLowerCase();
    quotes.seniority = senMatch[0];
    if (m.includes('staff') || m.includes('principal')) seniority = 'staff_principal';
    else if (m.includes('lead') || m.includes('architect')) seniority = 'lead_manager';
    else if (m.includes('senior') || m.includes('sr')) seniority = 'senior';
    else if (m.includes('junior') || m.includes('entry')) seniority = 'junior';
  }

  // 5. Years Required
  let yearsRequired: number | null = null;
  const yrMatch = fullText.match(/\b([0-9]{1,2})\+?\s*(?:-\s*[0-9]{1,2}\+?\s*)?years?(?:\s+of)?(?:\s+(?:relevant|hands-on|professional|software))?\s+experience\b/i);
  if (yrMatch) {
    const y = parseInt(yrMatch[1], 10);
    if (!isNaN(y)) {
      yearsRequired = y;
      quotes.yearsRequired = yrMatch[0];
    }
  }

  // 6. Role Family
  const roleClass = classifyRoleFamily(title, jdText);
  const roleFamily = roleClass.family;
  const isPresales = roleClass.presales;
  if (isPresales) {
    const m = fullText.match(/\b(pre-sales|presales|partner\s+architect|sales\s+engineer(ing)?|solutions\s+consultant)\b/i);
    quotes.presales = m ? m[0] : title;
  }

  // 7. Tech Stack Discovery (Word-boundary matching with verbatim quote capture)
  const candidateKnownTech = [
    'Java', 'Python', 'TypeScript', 'JavaScript', 'SQL', 'C++', 'Go', 'Rust',
    'Kafka', 'Microservices', 'Distributed Systems', 'PostgreSQL', 'MySQL', 'Oracle', 'MongoDB',
    'Redis', 'AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Jenkins', 'Linux',
    'FastAPI', 'Spring Boot', 'REST APIs', 'System Design', 'ETL',
    'Vector Databases', 'Pinecone', 'LLM', 'AI Agents', 'OpenAI',
  ];

  const mustHaveTech: string[] = [];
  for (const tech of candidateKnownTech) {
    const pat = new RegExp(`\\b${tech.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    const match = fullText.match(pat);
    if (match) {
      mustHaveTech.push(tech);
      quotes[`tech:${tech}`] = match[0];
    }
  }

  // 8. Domain Tags
  const domainTags: string[] = [];
  const domainKeywords = [
    { tag: 'Telecom', pat: /\b(telecom|telecommunications|bss|oss|crm|billing)\b/i },
    { tag: 'Distributed Systems', pat: /\b(distributed systems|high-throughput|fault-tolerant|streaming)\b/i },
    { tag: 'AI Platform', pat: /\b(ai agent|llm|vector database|generative ai|retrieval)\b/i },
    { tag: 'Fintech / Payments', pat: /\b(payments?|fintech|banking|pci|ledger)\b/i },
    { tag: 'Cloud Infrastructure', pat: /\b(cloud-native|infrastructure|platform engineering)\b/i },
  ];

  for (const item of domainKeywords) {
    const match = fullText.match(item.pat);
    if (match) {
      domainTags.push(item.tag);
      quotes[`domain:${item.tag}`] = match[0];
    }
  }

  const rawFacts: ExtractedJobFacts = {
    remoteScope,
    allowedCountries: [],
    excludedCountries: [],
    tzOverlap: null,
    engagement: 'employee',
    salary,
    visaSponsorship,
    seniority,
    roleFamily,
    mustHaveTech,
    niceToHaveTech: [],
    yearsRequired,
    domainTags,
    presales: isPresales,
    quotes,
  };

  return verifyExtractedFacts(rawFacts, {
    jdText,
    title,
    location,
  });
}

/**
 * Extracts structured facts using Google Gemini API (gemini-2.5-flash) with temperature 0.
 * Falls back to deterministic offline extractor if API key is not configured or on network failure.
 */
export async function extractJobFacts(input: {
  jobId: string;
  title: string;
  location: string;
  company: string;
  jdText: string;
  model?: string;
}): Promise<ExtractedJobFacts> {
  const modelName = input.model || process.env.MODEL_EXTRACT || 'gemini-2.5-flash';
  const contentHash = computeHash(input.jdText);

  // Check cache first
  const cached = getCachedExtraction(contentHash, PROMPT_VERSION, modelName);
  if (cached) {
    return cached;
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (apiKey) {
    const prompt = `
You are a precise, zero-fabrication job fact extractor.
Analyze the following Job Posting and extract structured facts with supporting verbatim quotes.

CRITICAL RULES:
1. ZERO FABRICATION: For every extracted value, you MUST provide a supporting 'quote' that is a VERBATIM SUBSTRING of the text.
2. If any fact is not explicitly stated in the text, set its value to "unknown" or null and quote to null. Do NOT assume or guess.
3. No point scores or evaluations. Extract only facts and quotes.

JOB DETAILS:
Title: ${input.title}
Company: ${input.company}
Location: ${input.location}

JOB DESCRIPTION:
${input.jdText}

Extract JSON with this exact schema:
{
  "remoteScope": "worldwide" | "apac" | "india" | "region_locked" | "hybrid" | "onsite" | "unknown",
  "allowedCountries": ["<country name>"],
  "excludedCountries": ["<country name>"],
  "tzOverlap": "<verbatim overlap statement or null>",
  "engagement": "employee" | "contractor" | "eor" | "unknown",
  "salary": {
    "min": <number or null>,
    "max": <number or null>,
    "currency": "<USD/EUR/INR/etc or null>",
    "period": "yearly" | "monthly" | "hourly" | null
  } | null,
  "visaSponsorship": "explicit" | "none" | "unknown",
  "seniority": "junior" | "mid" | "senior" | "staff_principal" | "lead_manager" | "unknown",
  "roleFamily": "backend_distributed" | "ai_agentic" | "architect" | "fullstack_backend" | "frontend_only" | "mobile_only" | "data_science_pure" | "unsupported",
  "mustHaveTech": ["<tech1>", "<tech2>"],
  "niceToHaveTech": ["<tech1>", "<tech2>"],
  "yearsRequired": <number or null>,
  "domainTags": ["<tag1>"],
  "presales": <boolean>,
  "quotes": {
    "remoteScope": "<verbatim quote or null>",
    "salary": "<verbatim quote or null>",
    "visaSponsorship": "<verbatim quote or null>",
    "seniority": "<verbatim quote or null>",
    "yearsRequired": "<verbatim quote or null>",
    "tzOverlap": "<verbatim quote or null>",
    "presales": "<verbatim quote or null>"
  }
}`;

    // Retry with exponential backoff (max 3 tries)
    const delays = [1000, 2000, 4000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.0,
                responseMimeType: 'application/json',
              },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText) as ExtractedJobFacts;
            const verified = verifyExtractedFacts(parsed, {
              jdText: input.jdText,
              title: input.title,
              location: input.location,
            });

            saveExtractionCache({
              jobId: input.jobId,
              contentHash,
              promptVersion: PROMPT_VERSION,
              model: modelName,
              extractionStatus: 'success',
              extractedJson: JSON.stringify(verified),
            });

            return verified;
          }
        }
      } catch (err) {
        console.warn(`[ExtractionEngine] Gemini call failed (attempt ${attempt + 1}):`, err);
        if (attempt < delays.length - 1) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
    }
  }

  // Offline / deterministic fallback extractor with strict quotes
  const offlineFacts = extractFactsOffline({
    title: input.title,
    location: input.location,
    company: input.company,
    jdText: input.jdText,
  });

  saveExtractionCache({
    jobId: input.jobId,
    contentHash,
    promptVersion: PROMPT_VERSION,
    model: 'offline-rule',
    extractionStatus: 'success',
    extractedJson: JSON.stringify(offlineFacts),
  });

  return offlineFacts;
}
