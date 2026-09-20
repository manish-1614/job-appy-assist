export interface Achievement {
  id: string;
  employerOrProject: string;
  claim: string;
  metric: string;
  period: string;
  evidence: string;
  skills: string[];
}

export interface ResumeBullet {
  achievementId: string;
  text: string;
}

export interface ResumeExperience {
  company: string;
  role: string;
  period: string;
  bullets: ResumeBullet[];
}

export interface BaseResumeVariant {
  id: string;
  name: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: {
    institution: string;
    degree: string;
    period: string;
    details: string;
  };
}

export interface SkillCoverageResult {
  coveredSkills: string[];
  gapList: string[];
  coverageRatio: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  unbankedEntities: string[];
}

export interface CoverLetterDraft {
  body: string;
  wordCount: number;
  openingQuote?: string;
  proofPointsUsed: string[];
  gapsMentioned: string[];
}

export interface TailoredApplicationKit {
  id: string;
  jobId: string;
  variantId: string;
  tailoredResume: BaseResumeVariant;
  coverLetter: CoverLetterDraft;
  coverage: SkillCoverageResult;
  approvedAt?: string;
  createdAt: string;
}
