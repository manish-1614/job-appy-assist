import { describe, it, expect } from 'vitest';
import { evaluateWithHeuristics } from '@/lib/ai-evaluator';
import { RawJobPosting } from '@/lib/ats-adapters';
import { CandidateProfile } from '@/lib/storage';

describe('Characterization: Heuristic Evaluator (lib/ai-evaluator.ts)', () => {
  const mockProfile: CandidateProfile = {
    version: '1.0',
    updatedAt: '2026-09-13T00:00:00.000Z',
    candidate: {
      name: 'Manish Kumar Prajapati',
      email: 'test@example.com',
      phone: '+91 9999999999',
      yearsOfExperience: 8.5,
      currentCompany: 'Amdocs',
      currentTitle: 'Software Engineer (Advanced)',
      education: 'MCA',
      headline: 'Senior Backend Engineer',
    },
    targetRoles: ['Staff Backend Engineer', 'Senior Backend Engineer'],
    coreSkills: {
      languages: ['Java', 'Python'],
      backendAndDistributed: ['Kafka', 'Microservices', 'Distributed Systems'],
      aiAndWorkflowAutomation: ['AI Agents', 'LLM Orchestration'],
      cloudAndDevOps: ['AWS', 'Docker'],
      databases: ['PostgreSQL'],
    },
    highlightedProjects: [],
    preferences: {
      workMode: ['Worldwide Remote', 'Remote (India Eligible)'],
      relocationTargetCountries: ['Japan (Tokyo)', 'South Korea (Seoul)'],
      relocationRequirement: 'Visa sponsorship',
      minimumSalaryInrLakhs: 25,
      targetSalaryInrLakhs: '35-65 Lakhs',
    },
    dealbreakers: [],
  };

  it('evaluates baseline score with seniority and domain boosts', () => {
    const rawJob: RawJobPosting = {
      source: 'greenhouse',
      externalId: '101',
      title: 'Staff Software Engineer, Distributed Systems',
      company: 'Datadog',
      location: 'Remote - India',
      applyUrl: 'https://example.com/apply/101',
      contentHtml: '<p>Looking for expertise in Kafka, Python, and AWS Cloud</p>',
      sourceType: 'ats',
    };

    const result = evaluateWithHeuristics(rawJob, mockProfile);

    // Baseline: 65
    // Staff boost: +20
    // Distributed Systems boost: +6
    // Kafka boost: +5
    // Python boost: +4
    // AWS Cloud boost: +3
    // Total raw: 65 + 20 + 6 + 5 + 4 + 3 = 103 -> capped at 99
    expect(result.score).toBe(99);
    expect(result.isRemote).toBe(true);
    expect(result.techStack).toContain('Distributed Systems');
    expect(result.techStack).toContain('Kafka');
  });

  it('characterizes F13: fabricates boilerplate salary string', () => {
    const rawJob: RawJobPosting = {
      source: 'lever',
      externalId: '102',
      title: 'Senior Backend Engineer',
      company: 'Acme',
      location: 'Bangalore, India',
      applyUrl: 'https://example.com/apply/102',
      sourceType: 'ats',
    };

    const result = evaluateWithHeuristics(rawJob, mockProfile);
    expect(result.salary).toBe('Salary not stated (Standard Senior Scale)');
  });

  it('characterizes F13: location alone (Tokyo) sets sponsorship to explicit', () => {
    const rawJob: RawJobPosting = {
      source: 'smartrecruiters',
      externalId: '103',
      title: 'Backend Engineer',
      company: 'Tokyo Corp',
      location: 'Tokyo, Japan',
      applyUrl: 'https://example.com/apply/103',
      contentHtml: '<p>Standard JD without sponsorship mentions.</p>',
      sourceType: 'ats',
    };

    const result = evaluateWithHeuristics(rawJob, mockProfile);
    expect(result.sponsorship).toBe('explicit');
  });
});
