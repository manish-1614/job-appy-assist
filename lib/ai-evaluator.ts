import { RawJobPosting, EvaluatedJob } from './ats-adapters';
import { loadCandidateProfile, CandidateProfile } from './storage';

export interface AiEvaluationResult {
  score: number;
  matchReason: string;
  strengths: string[];
  concerns: string[];
  sponsorship: 'explicit' | 'possible' | 'unconfirmed';
  evidenceQuotes: string[];
  techStack: string[];
  isRemote: boolean;
  salary: string;
}

/**
 * Stage 1: Deterministic Pre-Filter Gate
 * Drops clear mismatches (junior, intern, frontend-only) in sub-millisecond time.
 */
export function passesDeterministicGate(raw: RawJobPosting): boolean {
  const titleLower = raw.title.toLowerCase();
  
  // Hard exclusions
  const exclusionKeywords = [
    'junior', 'intern', 'internship', 'graduate', 'entry level',
    'freshman', 'associate software engineer', 'trainee',
    'frontend only', 'wordpress developer', 'ui designer'
  ];

  for (const kw of exclusionKeywords) {
    if (titleLower.includes(kw)) {
      return false;
    }
  }

  return true;
}

/**
 * Fallback / Rule-based Heuristic Evaluator
 * Calibrated against candidate profile (8.5+ yrs, Amdocs CRM, Distributed Systems, AI Agents, Python/Java).
 */
export function evaluateWithHeuristics(raw: RawJobPosting, profile: CandidateProfile): AiEvaluationResult {
  const titleLower = raw.title.toLowerCase();
  const locationLower = raw.location.toLowerCase();
  const contentLower = (raw.contentHtml || '').toLowerCase();

  let score = 65; // Baseline for passing gate

  // Seniority alignment
  if (titleLower.includes('staff') || titleLower.includes('principal') || titleLower.includes('architect') || titleLower.includes('lead')) {
    score += 20;
  } else if (titleLower.includes('senior') || titleLower.includes('sr')) {
    score += 12;
  }

  // Domain & Tech keywords
  const matchedTech: string[] = [];
  const domainWeights = [
    { name: 'Distributed Systems', pattern: /distributed systems|high-throughput|microservices|distributed architecture/i, boost: 6 },
    { name: 'Python', pattern: /python\b/i, boost: 4 },
    { name: 'Java', pattern: /java\b|spring boot/i, boost: 4 },
    { name: 'Kafka', pattern: /kafka|event-driven|streaming|pub[\s/-]?sub/i, boost: 5 },
    { name: 'AI Agents / LLM', pattern: /ai agent|llm|vector database|pinecone|orchestration|agentic/i, boost: 8 },
    { name: 'AWS Cloud', pattern: /aws|amazon web services|cloud-native|s3|rds/i, boost: 3 },
    { name: 'PostgreSQL / SQL', pattern: /postgres|postgresql|sql\b|database architecture/i, boost: 3 },
    { name: 'Docker / DevOps', pattern: /docker|kubernetes|ci\/cd|observability/i, boost: 3 },
    { name: 'System Design', pattern: /system design|scalability|fault-tolerant/i, boost: 5 },
  ];

  domainWeights.forEach(k => {
    if (k.pattern.test(titleLower) || k.pattern.test(contentLower)) {
      matchedTech.push(k.name);
      score += k.boost;
    }
  });

  // Sponsorship & Relocation check
  let sponsorship: 'explicit' | 'possible' | 'unconfirmed' = 'unconfirmed';
  if (
    contentLower.includes('visa sponsorship') || 
    contentLower.includes('relocation provided') || 
    contentLower.includes('relocation assistance') ||
    locationLower.includes('japan') || 
    locationLower.includes('tokyo') || 
    locationLower.includes('seoul') ||
    locationLower.includes('south korea')
  ) {
    sponsorship = 'explicit';
    score += 5;
  } else if (
    locationLower.includes('remote') || 
    locationLower.includes('worldwide') || 
    locationLower.includes('india') ||
    locationLower.includes('anywhere')
  ) {
    sponsorship = 'possible';
  }

  const isRemote = locationLower.includes('remote') || locationLower.includes('worldwide') || locationLower.includes('anywhere');
  score = Math.min(99, Math.max(50, score));

  const strengths = [
    `Strong match with 8.5+ yrs distributed backend and systems architecture experience.`,
    matchedTech.length > 0 ? `Detected core competencies: ${matchedTech.slice(0, 4).join(', ')}.` : `Aligned with cloud infrastructure expectations.`
  ];

  const concerns = [];
  if (!isRemote && !locationLower.includes('india') && sponsorship === 'unconfirmed') {
    concerns.push('International location without explicit visa sponsorship noted in posting.');
  }

  return {
    score,
    matchReason: `High-alignment senior role from ${raw.company}. Strong overlap with backend & distributed systems track record.`,
    strengths,
    concerns,
    sponsorship,
    evidenceQuotes: [
      `Role Title: "${raw.title}" matches target seniority (${profile.candidate.yearsOfExperience}+ years experienced tier).`,
      `Location: ${raw.location} (${isRemote ? 'Remote Friendly' : 'Location-bound'}).`,
      `Technology overlap: ${matchedTech.join(', ') || 'Backend engineering stack'}.`
    ],
    techStack: matchedTech.length > 0 ? matchedTech.slice(0, 5) : ['Backend', 'Distributed Systems', 'Cloud'],
    isRemote,
    salary: 'Salary not stated (Standard Senior Scale)'
  };
}

/**
 * Stage 2: Semantic LLM Evaluator (Gemini Flash API or local Ollama)
 */
export async function evaluateJobWithLLM(
  raw: RawJobPosting,
  profile: CandidateProfile
): Promise<AiEvaluationResult> {
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const useOllama = process.env.USE_OLLAMA === 'true';

  // If Gemini API Key is available and not forcing Ollama
  if (geminiApiKey && !useOllama) {
    try {
      const prompt = `
You are an expert technical recruiter assessing a job opportunity for a specific senior engineer.

CANDIDATE PROFILE:
Name: ${profile.candidate.name}
Experience: ${profile.candidate.yearsOfExperience}+ years
Current Title: ${profile.candidate.currentTitle} at ${profile.candidate.currentCompany}
Core Stack: ${profile.coreSkills.languages.join(', ')} | ${profile.coreSkills.backendAndDistributed.join(', ')}
Specialization: ${profile.coreSkills.aiAndWorkflowAutomation.join(', ')}
Key Projects: Amdocs CRM SaaS (millions of users, 40% latency reduction), Smriti (zero-fabrication AI companion, in-process cosine similarity).
Preferences: Remote (India / Worldwide) or Relocation to Japan (Tokyo) / South Korea (Seoul). Target: INR 35-65L.

JOB POSTING:
Title: ${raw.title}
Company: ${raw.company}
Location: ${raw.location}
Description Preview:
${(raw.contentHtml || '').slice(0, 2500)}

Evaluate fit strictly on a scale of 0 to 100.
Return JSON with this exact format:
{
  "score": <number 0-100>,
  "matchReason": "<1-2 sentence executive match summary>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "concerns": ["<concern 1>"],
  "sponsorship": "<'explicit' | 'possible' | 'unconfirmed'>",
  "evidenceQuotes": ["<quote from job description>"],
  "techStack": ["<tech1>", "<tech2>", "<tech3>"],
  "isRemote": <boolean>,
  "salary": "<stated salary or 'Salary not stated'>"
}`;

      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawJson) {
          const parsed = JSON.parse(rawJson);
          return {
            score: typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 75,
            matchReason: parsed.matchReason || `Matches senior profile from ${raw.company}`,
            strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
            concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
            sponsorship: ['explicit', 'possible', 'unconfirmed'].includes(parsed.sponsorship) ? parsed.sponsorship : 'unconfirmed',
            evidenceQuotes: Array.isArray(parsed.evidenceQuotes) ? parsed.evidenceQuotes : [],
            techStack: Array.isArray(parsed.techStack) ? parsed.techStack : ['Backend', 'Distributed Systems'],
            isRemote: Boolean(parsed.isRemote),
            salary: parsed.salary || 'Salary not stated'
          };
        }
      }
    } catch (err) {
      console.warn('Gemini API evaluation failed, falling back to heuristic evaluator:', err);
    }
  }

  // Fallback to local Ollama if configured
  if (useOllama) {
    try {
      const ollamaRes = await fetch(`${ollamaHost}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'qwen2.5:latest',
          prompt: `Evaluate job fit for ${profile.candidate.name} (8.5+ yrs backend/distributed/AI): Title: ${raw.title}, Company: ${raw.company}, Location: ${raw.location}. Output JSON with score (0-100), matchReason, strengths, sponsorship.`,
          format: 'json',
          stream: false
        })
      });
      if (ollamaRes.ok) {
        const oData = await ollamaRes.json();
        if (oData.response) {
          const parsed = JSON.parse(oData.response);
          return {
            ...evaluateWithHeuristics(raw, profile),
            score: parsed.score || 75,
            matchReason: parsed.matchReason || `Ollama evaluation from ${raw.company}`
          };
        }
      }
    } catch (err) {
      console.warn('Ollama evaluation failed:', err);
    }
  }

  // High-precision heuristic fallback
  return evaluateWithHeuristics(raw, profile);
}
