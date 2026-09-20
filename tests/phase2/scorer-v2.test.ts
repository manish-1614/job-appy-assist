import { describe, it, expect } from 'vitest';
import { scoreJobV2 } from '@/lib/scorer';
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
  targetRoles: ['Senior Backend Engineer', 'Staff Engineer', 'Distributed Systems Architect'],
  coreSkills: {
    languages: [
      { name: 'Python', verified: true },
      { name: 'Java', verified: true },
      { name: 'TypeScript', verified: true },
    ],
    backendAndDistributed: [
      { name: 'Microservices Architecture', verified: true },
      { name: 'Distributed Systems', verified: true },
      { name: 'Kafka', verified: true },
      { name: 'High-Throughput Pipelines', verified: true },
    ],
    aiAndWorkflowAutomation: [
      { name: 'AI Agents & Agentic Loops', verified: true },
      { name: 'LLM Orchestration', verified: true },
    ],
    cloudAndDevOps: [
      { name: 'AWS', verified: true },
      { name: 'Docker', verified: true },
      { name: 'Kubernetes', verified: true },
    ],
    databases: [
      { name: 'PostgreSQL', verified: true },
      { name: 'MongoDB', verified: true },
    ],
  },
  highlightedProjects: [],
  preferences: {
    workMode: ['Worldwide Remote', 'Remote (India Eligible)'],
    relocationTargetCountries: ['Japan (Tokyo)'],
    relocationRequirement: 'Sponsorship required',
    minimumSalaryInrLakhs: 25,
    targetSalaryInrLakhs: '35-65 Lakhs',
  },
  dealbreakers: [],
};

describe('Scorer v2 Unified Pipeline', () => {
  it('correctly scores an eligible Tier-A distributed systems role', async () => {
    const jdText = `
      We are hiring a Senior Staff Distributed Systems Engineer.
      Location: Worldwide Remote.
      Requirements:
      - 8+ years experience building high-throughput microservices
      - Deep expertise in Java, Kafka, and PostgreSQL
      - Compensation: $160,000 - $200,000 USD per year.
    `;

    const result = await scoreJobV2({
      job: {
        id: 'test:stripe:101',
        title: 'Senior Staff Distributed Systems Engineer',
        company: 'Stripe',
        location: 'Worldwide Remote',
        firstPublishedAt: new Date().toISOString(),
      },
      jdText,
      profile: mockProfile,
      offlineOnly: true,
    });

    expect(result.gate.passed).toBe(true);
    expect(result.gate.locationClass).toBe('remote_worldwide');
    expect(result.tier).toBe('tier_a');
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.subScores.roleFit).toBe(1.0);
    expect(result.facts.mustHaveTech).toContain('Java');
    expect(result.facts.mustHaveTech).toContain('Kafka');
  });

  it('gates on-site foreign roles (e.g. Chicago, Seattle) into Tier C', async () => {
    const jdText = `
      Onsite role at our Chicago headquarters.
      Must have 8 years experience in Java and distributed systems.
    `;

    const result = await scoreJobV2({
      job: {
        id: 'test:stripe:chicago',
        title: 'Staff Software Engineer',
        company: 'Stripe',
        location: 'Chicago, IL, United States',
      },
      jdText,
      profile: mockProfile,
      offlineOnly: true,
    });

    expect(result.gate.passed).toBe(false);
    expect(result.gate.locationClass).toBe('onsite_elsewhere');
    expect(result.gate.gateReason).toBe('gated:onsite_elsewhere');
    expect(result.tier).toBe('tier_c');
    expect(result.score).toBeLessThanOrEqual(59);
  });

  it('gates junior roles and assigns gateReason', async () => {
    const jdText = 'Looking for a Junior Backend Developer. 1 year experience.';
    const result = await scoreJobV2({
      job: {
        id: 'test:acme:jr',
        title: 'Junior Software Engineer',
        company: 'Acme Corp',
        location: 'Remote Worldwide',
      },
      jdText,
      profile: mockProfile,
      offlineOnly: true,
    });

    expect(result.gate.passed).toBe(false);
    expect(result.gate.gateReason).toBe('gated:role_title_seniority');
    expect(result.tier).toBe('tier_c');
    expect(result.score).toBeLessThanOrEqual(59);
  });
});
