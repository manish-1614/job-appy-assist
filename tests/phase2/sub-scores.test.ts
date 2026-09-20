import { describe, it, expect } from 'vitest';
import {
  calculateRoleFit,
  calculateStackOverlap,
  calculateReachability,
  calculateDomainAffinity,
  calculateFreshness,
  calculateCompFit,
  evaluateSubScores,
  INITIAL_WEIGHTS,
} from '@/lib/scorer/sub-scores';
import { ExtractedJobFacts, GateResult } from '@/lib/scorer/types';
import { CandidateProfile } from '@/lib/storage';

const mockProfile: CandidateProfile = {
  version: '1.0',
  updatedAt: new Date().toISOString(),
  candidate: {
    name: 'Manish Kumar Prajapati',
    email: 'test@example.com',
    phone: '123',
    portfolioUrl: '',
    githubUrl: '',
    linkedinUrl: '',
    yearsOfExperience: 8.5,
    currentCompany: 'Amdocs',
    currentTitle: 'Software Engineer (Advanced)',
    education: 'MCA',
    headline: 'Senior Backend Engineer',
  },
  targetRoles: ['Senior Backend Engineer', 'Staff Engineer'],
  coreSkills: {
    languages: [
      { name: 'Python', verified: true },
      { name: 'Java', verified: true },
      { name: 'TypeScript', verified: true },
      { name: 'Rust', verified: false }, // Unverified, must not count!
    ],
    backendAndDistributed: [
      { name: 'Microservices Architecture', verified: true },
      { name: 'Distributed Systems', verified: true },
      { name: 'Kafka', verified: true },
    ],
    aiAndWorkflowAutomation: [
      { name: 'AI Agents & Agentic Loops', verified: true },
      { name: 'LLM Orchestration', verified: true },
    ],
    cloudAndDevOps: [
      { name: 'AWS', verified: true },
      { name: 'Docker', verified: true },
    ],
    databases: [
      { name: 'PostgreSQL', verified: true },
    ],
  },
  highlightedProjects: [],
  preferences: {
    workMode: ['Worldwide Remote'],
    relocationTargetCountries: ['Japan (Tokyo)'],
    relocationRequirement: 'Sponsorship required',
    minimumSalaryInrLakhs: 25,
    targetSalaryInrLakhs: '35-65 Lakhs',
  },
  dealbreakers: [],
};

const mockPassingGate: GateResult = {
  passed: true,
  gateReason: null,
  locationClass: 'remote_worldwide',
  gRole: { passed: true },
  gEligibility: { passed: true },
  gComp: { passed: true },
  gSponsorship: { passed: true },
};

function createFacts(overrides: Partial<ExtractedJobFacts> = {}): ExtractedJobFacts {
  return {
    remoteScope: 'worldwide',
    allowedCountries: [],
    excludedCountries: [],
    tzOverlap: null,
    engagement: 'employee',
    salary: null,
    visaSponsorship: 'unknown',
    seniority: 'senior',
    roleFamily: 'backend_distributed',
    mustHaveTech: ['Java', 'Kafka'],
    niceToHaveTech: ['Python'],
    yearsRequired: 8,
    domainTags: ['Distributed Systems'],
    presales: false,
    quotes: {},
    ...overrides,
  };
}

describe('Deterministic Sub-scores (Phase 2)', () => {
  it('weights sum exactly to 1.00', () => {
    const sum =
      INITIAL_WEIGHTS.roleFit +
      INITIAL_WEIGHTS.stackOverlap +
      INITIAL_WEIGHTS.reachability +
      INITIAL_WEIGHTS.domainAffinity +
      INITIAL_WEIGHTS.freshness +
      INITIAL_WEIGHTS.compFit +
      INITIAL_WEIGHTS.companySignal;

    expect(Math.round(sum * 100) / 100).toBe(1.00);
  });

  it('calculates roleFit correctly based on family priority and seniority', () => {
    const factsBackend = createFacts({ roleFamily: 'backend_distributed' });
    expect(calculateRoleFit(factsBackend, 'Senior Staff Software Engineer')).toBe(1.0);

    const factsPresales = createFacts({ roleFamily: 'architect', presales: true });
    // Architect (0.85) downweighted for presales (0.70)
    expect(calculateRoleFit(factsPresales, 'Solutions Architect')).toBe(0.70);
  });

  it('calculates stackOverlap using verified skills only (Section 7.5)', () => {
    // Both Java & Kafka are verified -> 100% must have match
    const facts = createFacts({
      mustHaveTech: ['Java', 'Kafka'],
      niceToHaveTech: ['Rust'], // Rust is unverified in profile!
    });

    const score = calculateStackOverlap(facts, mockProfile);
    // Weighted matches: mustMatch (2*2) + niceMatch (0) = 4 / (2*2 + 1) = 4/5 = 0.80
    expect(score).toBeCloseTo(0.80, 2);
  });

  it('calculates reachability realistically without auto-boosting Staff/Principal', () => {
    const factsOptimal = createFacts({ yearsRequired: 8 });
    expect(calculateReachability(factsOptimal, mockProfile)).toBe(1.00);

    const factsSeniorStretch = createFacts({ yearsRequired: 11 });
    expect(calculateReachability(factsSeniorStretch, mockProfile)).toBe(0.85);

    const factsExtreme = createFacts({ yearsRequired: 18 });
    expect(calculateReachability(factsExtreme, mockProfile)).toBe(0.35);
  });

  it('applies ghost-job penalty for roles older than 90 days', () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const hundredDaysAgo = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString();

    expect(calculateFreshness(twoDaysAgo, null)).toBe(1.00);
    expect(calculateFreshness(hundredDaysAgo, null)).toBe(0.10);
  });

  it('computes Tier A for high-alignment opportunities', () => {
    const facts = createFacts({
      mustHaveTech: ['Java', 'Kafka', 'Microservices Architecture'],
      niceToHaveTech: ['Python', 'Docker'],
      domainTags: ['Distributed Systems', 'Telecom'],
      salary: { min: 140000, max: 180000, currency: 'USD', period: 'yearly' }, // ~1.5 Cr INR
    });

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = evaluateSubScores(
      facts,
      {
        title: 'Senior Staff Distributed Systems Engineer',
        company: 'Stripe',
        location: 'Remote Worldwide',
        firstPublishedAt: twoDaysAgo,
      },
      mockPassingGate,
      mockProfile
    );

    expect(result.totalScore).toBeGreaterThanOrEqual(75);
    expect(result.tier).toBe('tier_a');
  });

  it('caps failed-gate roles at 59 and assigns Tier C', () => {
    const failedGate: GateResult = {
      passed: false,
      gateReason: 'gated:region_locked',
      locationClass: 'region_locked',
      gRole: { passed: true },
      gEligibility: { passed: false, reason: 'gated:region_locked' },
      gComp: { passed: true },
      gSponsorship: { passed: true },
    };

    const facts = createFacts();
    const result = evaluateSubScores(
      facts,
      {
        title: 'Senior Staff Distributed Systems Engineer',
        company: 'Stripe',
        location: 'Remote - US Only',
      },
      failedGate,
      mockProfile
    );

    expect(result.totalScore).toBeLessThanOrEqual(59);
    expect(result.tier).toBe('tier_c');
  });
});
