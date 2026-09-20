import { describe, it, expect } from 'vitest';
import { aggregateSkillGaps } from '../../lib/skill-gap';
import { CandidateProfile } from '../../lib/storage';
import { EvaluatedJob } from '../../lib/ats-adapters';

const mockProfile: CandidateProfile = {
  name: 'Candidate',
  targetRoles: ['Staff Software Engineer'],
  targetLocations: ['Remote'],
  preferredAts: ['greenhouse'],
  coreSkills: {
    languages: [{ name: 'Java', verified: true }, { name: 'Python', verified: true }],
    frameworks: [{ name: 'Spring Boot', verified: true }],
    data: [{ name: 'PostgreSQL', verified: true }],
  },
  salaryExpectation: { min: 2500000, target: 4500000, currency: 'INR' },
  hardFloor: 2500000,
  minExperienceYears: 8,
  preferredTimezones: ['IST'],
};

const mockJobs: EvaluatedJob[] = [
  {
    id: 'job-1',
    title: 'Senior Backend Engineer',
    company: 'Stripe',
    location: 'Remote',
    score: 85,
    tier: 'tier_a',
    status: 'open',
    salary: 'Salary not stated',
    sponsorship: 'unconfirmed',
    isRemote: true,
    matchReason: 'Match',
    evidence: [],
    techStack: ['Java', 'Kubernetes', 'Go', 'Kafka'],
    postedAgo: 'Today',
    source: 'ats',
    canonicalUrl: 'https://example.com/1',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 'job-2',
    title: 'Lead Platform Engineer',
    company: 'GitLab',
    location: 'Remote',
    score: 80,
    tier: 'tier_a',
    status: 'open',
    salary: 'Salary not stated',
    sponsorship: 'unconfirmed',
    isRemote: true,
    matchReason: 'Match',
    evidence: [],
    techStack: ['Go', 'Kubernetes', 'PostgreSQL'],
    postedAgo: 'Today',
    source: 'ats',
    canonicalUrl: 'https://example.com/2',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 'job-3',
    title: 'Backend Engineer',
    company: 'Vercel',
    location: 'Remote',
    score: 72,
    tier: 'tier_b',
    status: 'open',
    salary: 'Salary not stated',
    sponsorship: 'unconfirmed',
    isRemote: true,
    matchReason: 'Match',
    evidence: [],
    techStack: ['TypeScript', 'Kubernetes', 'AWS'],
    postedAgo: 'Today',
    source: 'ats',
    canonicalUrl: 'https://example.com/3',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: 'job-4',
    title: 'Intern',
    company: 'Acme',
    location: 'Remote',
    score: 40,
    tier: 'tier_c',
    status: 'open',
    salary: 'Salary not stated',
    sponsorship: 'unconfirmed',
    isRemote: true,
    matchReason: 'Low score',
    evidence: [],
    techStack: ['Ruby'],
    postedAgo: 'Today',
    source: 'ats',
    canonicalUrl: 'https://example.com/4',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  },
];

describe('Skill-Gap Aggregator', () => {
  it('identifies top missing skills across Tier A and Tier B jobs only', () => {
    const summary = aggregateSkillGaps(mockProfile, mockJobs);

    expect(summary.totalAnalyzedJobs).toBe(3); // excludes Tier C job-4
    expect(summary.tierAJobsCount).toBe(2);
    expect(summary.tierBJobsCount).toBe(1);

    // Kubernetes is missing and required in all 3 jobs
    const topMissing = summary.topMissingSkills;
    expect(topMissing.length).toBeGreaterThan(0);
    expect(topMissing[0].skill).toBe('Kubernetes');
    expect(topMissing[0].demandCount).toBe(3);
    expect(topMissing[0].isMissing).toBe(true);

    // Go is missing and required in 2 jobs
    const goSkill = topMissing.find(s => s.skill === 'Go');
    expect(goSkill).toBeDefined();
    expect(goSkill?.demandCount).toBe(2);

    // Matched skills include Java (1) and PostgreSQL (1)
    const matched = summary.topMatchedSkills;
    const javaSkill = matched.find(s => s.skill === 'Java');
    expect(javaSkill).toBeDefined();
    expect(javaSkill?.verifiedByCandidate).toBe(true);
  });
});
