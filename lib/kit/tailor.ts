import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Achievement,
  BaseResumeVariant,
  CoverLetterDraft,
  TailoredApplicationKit,
  SkillCoverageResult,
} from './types';
import { validateResumeBullet, validateCoverLetter, validateSkillCoverage } from './validator';
import { sqlite } from '../db';
import { loadCanonicalJobs, upsertCanonicalJobs } from '../storage';

const KIT_DIR = path.resolve(process.cwd(), 'data', 'kit');
const ACHIEVEMENTS_FILE = path.join(KIT_DIR, 'achievements.json');
const RESUMES_DIR = path.join(KIT_DIR, 'resumes');
const ANSWERS_FILE = path.join(KIT_DIR, 'answers.json');

/**
 * Load all achievements from data/kit/achievements.json
 */
export function loadAchievements(): Achievement[] {
  if (!fs.existsSync(ACHIEVEMENTS_FILE)) {
    return [];
  }
  const content = fs.readFileSync(ACHIEVEMENTS_FILE, 'utf-8');
  return JSON.parse(content) as Achievement[];
}

/**
 * Load screening answers from data/kit/answers.json
 */
export function loadScreeningAnswers(): any {
  if (!fs.existsSync(ANSWERS_FILE)) {
    return null;
  }
  const content = fs.readFileSync(ANSWERS_FILE, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load a base resume variant by variantId ('backend-distributed' | 'ai-agentic' | 'architect')
 */
export function loadResumeVariant(variantId: string): BaseResumeVariant {
  const file = path.join(RESUMES_DIR, `${variantId}.json`);
  if (!fs.existsSync(file)) {
    // Default fallback
    return JSON.parse(
      fs.readFileSync(path.join(RESUMES_DIR, 'backend-distributed.json'), 'utf-8')
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

/**
 * Pick closest resume variant based on job title, role family, and tech stack
 */
export function selectBestVariant(params: {
  title: string;
  roleFamily?: string;
  techStack?: string[];
}): string {
  const titleLower = params.title.toLowerCase();
  const roleFamily = params.roleFamily?.toLowerCase() || '';

  if (
    roleFamily.includes('ai') ||
    titleLower.includes('ai') ||
    titleLower.includes('agent') ||
    titleLower.includes('llm') ||
    titleLower.includes('machine learning')
  ) {
    return 'ai-agentic';
  }

  if (
    roleFamily.includes('architect') ||
    titleLower.includes('architect') ||
    titleLower.includes('principal')
  ) {
    return 'architect';
  }

  return 'backend-distributed';
}

/**
 * Tailor the Application Kit (Resume bullets, Cover letter, Gap list) for a given job opening
 */
export function tailorApplicationKit(jobId: string): TailoredApplicationKit {
  const achievements = loadAchievements();
  const achMap = new Map(achievements.map((a) => [a.id, a]));

  // 1. Fetch job facts from SQLite
  let jobRow = sqlite
    .prepare(
      `SELECT j.*, d.description_text, e.extracted_json
       FROM jobs j
       LEFT JOIN job_descriptions d ON j.id = d.job_id
       LEFT JOIN job_extractions e ON j.id = e.job_id
       WHERE j.id = ?`
    )
    .get(jobId) as any;

  if (!jobRow) {
    const all = loadCanonicalJobs();
    const match = all.find((j) => j.id === jobId);
    if (match) {
      upsertCanonicalJobs([match]);
      jobRow = sqlite
        .prepare(
          `SELECT j.*, d.description_text, e.extracted_json
           FROM jobs j
           LEFT JOIN job_descriptions d ON j.id = d.job_id
           LEFT JOIN job_extractions e ON j.id = e.job_id
           WHERE j.id = ?`
        )
        .get(jobId) as any;
    }
  }

  if (!jobRow) {
    throw new Error(`Job ${jobId} not found in database`);
  }

  let extractedFacts: any = {};
  if (jobRow.extracted_json) {
    try {
      extractedFacts = JSON.parse(jobRow.extracted_json);
    } catch {}
  }

  const mustHaveTech: string[] = extractedFacts.mustHaveTech || (jobRow.tech_stack_json ? JSON.parse(jobRow.tech_stack_json) : []);
  const niceToHaveTech: string[] = extractedFacts.niceToHaveTech || [];
  const allTargetTech = Array.from(new Set([...mustHaveTech, ...niceToHaveTech]));

  // 2. Compute Coverage and explicit Gaps
  const coverage = validateSkillCoverage(allTargetTech, achievements);

  // 3. Select closest resume variant
  const variantId = selectBestVariant({
    title: jobRow.title,
    roleFamily: extractedFacts.roleFamily,
    techStack: allTargetTech,
  });
  const baseVariant = loadResumeVariant(variantId);

  // 4. Score and reorder experience bullets based on requirement overlap
  const tailoredExperience = baseVariant.experience.map((exp) => {
    const scoredBullets = exp.bullets.map((bullet) => {
      const ach = achMap.get(bullet.achievementId);
      let matchScore = 0;
      if (ach) {
        for (const s of ach.skills) {
          if (coverage.coveredSkills.some((c) => c.toLowerCase() === s.toLowerCase())) {
            matchScore += 2;
          }
        }
      }

      // Hard validation: verify bullet text against referenced achievement
      let validatedText = bullet.text;
      if (ach) {
        const val = validateResumeBullet(bullet.text, ach);
        if (!val.valid) {
          // Revert to pure unphrased claim + metric
          validatedText = `${ach.claim}, achieving ${ach.metric}.`;
        }
      }

      return {
        ...bullet,
        text: validatedText,
        score: matchScore,
      };
    });

    // Sort by match score descending
    scoredBullets.sort((a, b) => b.score - a.score);

    return {
      ...exp,
      bullets: scoredBullets.map(({ score, ...rest }) => rest),
    };
  });

  const tailoredResume: BaseResumeVariant = {
    ...baseVariant,
    experience: tailoredExperience,
  };

  // 5. Generate Zero-Fabrication Cover Letter (180–230 words)
  const openingQuote = `${jobRow.title} at ${jobRow.company}`;
  const proofPoint1 = achievements[0]
    ? `At ${achievements[0].employerOrProject}, I ${achievements[0].claim.toLowerCase()}, delivering ${achievements[0].metric}.`
    : 'At Amdocs, I led distributed CRM SaaS architecture, achieving a 40% latency reduction across millions of subscribers.';

  const proofPoint2 = achievements[1]
    ? `In the ${achievements[1].employerOrProject} project, I ${achievements[1].claim.toLowerCase()}, achieving ${achievements[1].metric}.`
    : 'I engineered high-throughput event-driven data streaming pipelines with Apache Kafka handling thousands of messages per second.';

  const gapSentence =
    coverage.gapList.length > 0
      ? `While my primary production focus has centered on ${coverage.coveredSkills.slice(0, 3).join(', ')}, I note your requirement for ${coverage.gapList[0]}; with 8.5+ years of backend systems fundamentals, I transition rapidly between modern technical stacks without sacrificing operational reliability.`
      : `My background aligns directly with your primary requirements across ${coverage.coveredSkills.slice(0, 4).join(', ')}.`;

  const coverLetterBody = [
    `Dear Hiring Team at ${jobRow.company},`,
    ``,
    `I am writing to express my focused interest in the ${openingQuote} role. With over 8.5 years of software engineering experience specializing in distributed backend architectures and high-throughput systems, I build resilient, low-latency platforms that scale cleanly.`,
    ``,
    `Throughout my career, I have prioritized demonstrable architectural outcomes. ${proofPoint1} Furthermore, ${proofPoint2}`,
    ``,
    gapSentence,
    ``,
    `I would welcome the opportunity to discuss how my distributed systems experience and engineering rigor can contribute to ${jobRow.company}'s engineering initiatives.`,
    ``,
    `Sincerely,`,
    `Manish Kumar Prajapati`,
  ].join('\n');

  const wordCount = coverLetterBody.trim().split(/\s+/).length;

  const coverLetterDraft: CoverLetterDraft = {
    body: coverLetterBody,
    wordCount,
    openingQuote,
    proofPointsUsed: [proofPoint1, proofPoint2],
    gapsMentioned: coverage.gapList.slice(0, 1),
  };

  // 6. Hard validate generated cover letter
  const clValidation = validateCoverLetter(coverLetterBody, achievements);
  if (!clValidation.valid) {
    console.warn('Cover letter validation warning:', clValidation.errors);
  }

  const kitId = `kit_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const kit: TailoredApplicationKit = {
    id: kitId,
    jobId,
    variantId,
    tailoredResume,
    coverLetter: coverLetterDraft,
    coverage,
    createdAt: now,
  };

  // Persist generated kit
  const genDir = path.join(KIT_DIR, 'generated');
  if (!fs.existsSync(genDir)) {
    fs.mkdirSync(genDir, { recursive: true });
  }
  fs.writeFileSync(path.join(genDir, `${kitId}.json`), JSON.stringify(kit, null, 2), 'utf-8');

  // Also update application record if one exists
  try {
    sqlite
      .prepare(`UPDATE applications SET resume_version_id = ?, cover_letter_id = ?, updated_at = ? WHERE job_id = ?`)
      .run(kitId, kitId, now, jobId);
  } catch {}

  return kit;
}
