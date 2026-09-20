import { Achievement, SkillCoverageResult, ValidationResult } from './types';

// Standard tech dictionary for checking hallucinated technologies
const KNOWN_TECH_LIST = [
  'Kubernetes', 'K8s', 'Docker', 'Redis', 'Kafka', 'RabbitMQ', 'PostgreSQL', 'MySQL',
  'MongoDB', 'Cassandra', 'DynamoDB', 'Elasticsearch', 'Solr', 'Spark', 'Flink',
  'Hadoop', 'Airflow', 'Snowflake', 'BigQuery', 'AWS', 'GCP', 'Azure', 'Terraform',
  'Ansible', 'Java', 'Spring Boot', 'Python', 'FastAPI', 'Django', 'Flask',
  'TypeScript', 'JavaScript', 'Node.js', 'React', 'Next.js', 'Vue', 'Angular',
  'Go', 'Golang', 'Rust', 'C++', 'C#', '.NET', 'GraphQL', 'gRPC', 'Protobuf',
  'Pinecone', 'Weaviate', 'Milvus', 'Qdrant', 'Chroma', 'LangChain', 'LlamaIndex'
];

// Superlatives and buzzwords strictly forbidden by zero-fabrication guidelines
const FORBIDDEN_SUPERLATIVES = [
  'rockstar', 'ninja', 'guru', 'wizard', 'superstar',
  'unmatched', 'best in the world', 'unrivaled', 'peerless'
];

// Known candidate numbers (8.5 years, MCA 2014-2017, CGPA 8.02, AIR 7)
const CANDIDATE_PROFILE_NUMBERS = new Set(['8.5', '8', '2014', '2017', '8.02', '7']);

/**
 * Validate skill coverage against all banked achievements without papering over gaps
 */
export function validateSkillCoverage(
  jdRequirements: string[],
  achievements: Achievement[]
): SkillCoverageResult {
  const allBankedSkills = new Set<string>();
  for (const ach of achievements) {
    for (const s of ach.skills) {
      allBankedSkills.add(s.toLowerCase());
    }
  }

  const coveredSkills: string[] = [];
  const gapList: string[] = [];

  for (const req of jdRequirements) {
    const lowerReq = req.toLowerCase().trim();
    if (!lowerReq) continue;

    let isCovered = false;
    for (const banked of allBankedSkills) {
      if (
        banked === lowerReq ||
        banked.includes(lowerReq) ||
        lowerReq.includes(banked)
      ) {
        isCovered = true;
        break;
      }
    }

    if (isCovered) {
      coveredSkills.push(req);
    } else {
      gapList.push(req);
    }
  }

  const total = jdRequirements.length || 1;
  const coverageRatio = Number((coveredSkills.length / total).toFixed(2));

  return {
    coveredSkills,
    gapList,
    coverageRatio,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Hard validator for a single tailored resume bullet against its referenced achievement
 */
export function validateResumeBullet(
  bulletText: string,
  achievement: Achievement
): ValidationResult {
  const errors: string[] = [];
  const unbankedEntities: string[] = [];

  // 1. Extract numbers and percentages from the bullet
  const bulletNumbers = bulletText.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  const achievementFullText = `${achievement.claim} ${achievement.metric} ${achievement.period}`.toLowerCase();

  for (const num of bulletNumbers) {
    const rawNum = num.replace('%', '');
    if (!achievementFullText.includes(num.toLowerCase()) && !achievementFullText.includes(rawNum)) {
      errors.push(`Unbanked number or metric "${num}" not found in achievement "${achievement.id}"`);
      unbankedEntities.push(num);
    }
  }

  // 2. Check for unbanked tools / technologies
  const achSkillsLower = new Set(achievement.skills.map((s) => s.toLowerCase()));
  const achClaimLower = achievement.claim.toLowerCase();

  for (const tech of KNOWN_TECH_LIST) {
    const escaped = escapeRegex(tech);
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(bulletText)) {
      const lowerTech = tech.toLowerCase();
      const isBankedInSkills = achSkillsLower.has(lowerTech) || Array.from(achSkillsLower).some((s) => s.includes(lowerTech));
      const isBankedInClaim = achClaimLower.includes(lowerTech);

      if (!isBankedInSkills && !isBankedInClaim) {
        errors.push(`Unbanked tool "${tech}" not present in achievement "${achievement.id}" skills`);
        unbankedEntities.push(tech);
      }
    }
  }

  // 3. Check for unbanked employers / companies
  const commonEmployers = ['Google', 'Meta', 'Netflix', 'Amazon', 'Apple', 'Microsoft', 'Uber', 'Stripe'];
  for (const emp of commonEmployers) {
    const regex = new RegExp(`\\b${emp}\\b`, 'i');
    if (regex.test(bulletText)) {
      const employerAllowed = achievement.employerOrProject.toLowerCase().includes(emp.toLowerCase());
      if (!employerAllowed) {
        errors.push(`Unbanked employer or client "${emp}" referenced in bullet`);
        unbankedEntities.push(emp);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    unbankedEntities,
  };
}

/**
 * Hard validator for generated cover letter
 */
export function validateCoverLetter(
  body: string,
  achievements: Achievement[]
): ValidationResult {
  const errors: string[] = [];
  const unbankedEntities: string[] = [];

  // 1. Check for forbidden superlatives
  const lowerBody = body.toLowerCase();
  for (const sup of FORBIDDEN_SUPERLATIVES) {
    if (lowerBody.includes(sup)) {
      errors.push(`Cover letter contains forbidden superlative or filler: "${sup}"`);
      unbankedEntities.push(sup);
    }
  }

  // 2. Check word count (target 180 - 230 words)
  const words = body.trim().split(/\s+/).filter(Boolean);
  if (words.length < 100 || words.length > 350) {
    errors.push(`Cover letter length (${words.length} words) deviates from standard 180–230 range`);
  }

  // 3. Check numbers against achievement bank and candidate profile
  const numbersInBody = body.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
  const combinedAchText = achievements
    .map((a) => `${a.claim} ${a.metric} ${a.period}`)
    .join(' ')
    .toLowerCase();

  for (const num of numbersInBody) {
    const rawNum = num.replace('%', '');
    const isProfileNumber = CANDIDATE_PROFILE_NUMBERS.has(num) || CANDIDATE_PROFILE_NUMBERS.has(rawNum);
    const isBankedNumber = combinedAchText.includes(num.toLowerCase()) || combinedAchText.includes(rawNum);

    if (!isProfileNumber && !isBankedNumber) {
      errors.push(`Cover letter contains unbanked metric/number: "${num}"`);
      unbankedEntities.push(num);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    unbankedEntities,
  };
}
