import { describe, it, expect } from 'vitest';
import { validateResumeBullet, validateCoverLetter, validateSkillCoverage } from '../../lib/kit/validator';
import { Achievement } from '../../lib/kit/types';

describe('Phase 4: Hard Validator & Zero-Fabrication Guardrail', () => {
  const mockAchievement: Achievement = {
    id: 'ach_crm',
    employerOrProject: 'Amdocs',
    claim: 'Led distributed CRM SaaS architecture for telecom subscribers',
    metric: '40% latency reduction in CSR queries across millions of subscribers',
    period: '2020 - Present',
    evidence: 'Production CRM release',
    skills: ['Java', 'Spring Boot', 'Kafka', 'PostgreSQL', 'Microservices Architecture', 'Distributed Systems'],
  };

  const allAchievements = [mockAchievement];

  it('approves a bullet containing only banked numbers, tools, and employers', () => {
    const validBullet = 'Led distributed CRM SaaS architecture at Amdocs using Java and Kafka, achieving 40% latency reduction.';
    const result = validateResumeBullet(validBullet, mockAchievement);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('adversarially rejects a bullet with an unbanked/hallucinated tool', () => {
    // Mentions "Kubernetes" and "Redis" which are not in this achievement's skills
    const adversarialBullet = 'Led distributed CRM SaaS architecture at Amdocs using Kubernetes, Redis, and Java, achieving 40% latency reduction.';
    const result = validateResumeBullet(adversarialBullet, mockAchievement);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Kubernetes') || e.includes('Redis'))).toBe(true);
  });

  it('adversarially rejects a bullet with an inflated/hallucinated metric or number', () => {
    // Changed 40% to 90%
    const inflatedBullet = 'Led distributed CRM SaaS architecture at Amdocs using Java and Kafka, achieving 90% latency reduction.';
    const result = validateResumeBullet(inflatedBullet, mockAchievement);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('90%') || e.includes('90'))).toBe(true);
  });

  it('adversarially rejects an unbanked employer or project', () => {
    const fakeEmployerBullet = 'Led distributed CRM architecture at Netflix using Java and Kafka, achieving 40% latency reduction.';
    const result = validateResumeBullet(fakeEmployerBullet, mockAchievement);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Netflix'))).toBe(true);
  });

  it('computes transparent skill gaps without papering over them', () => {
    const jdRequirements = ['Java', 'Kafka', 'Kubernetes', 'Go', 'PostgreSQL'];
    const coverage = validateSkillCoverage(jdRequirements, allAchievements);

    expect(coverage.coveredSkills).toContain('Java');
    expect(coverage.coveredSkills).toContain('Kafka');
    expect(coverage.coveredSkills).toContain('PostgreSQL');

    // Gaps must be explicitly listed
    expect(coverage.gapList).toContain('Kubernetes');
    expect(coverage.gapList).toContain('Go');
    expect(coverage.coverageRatio).toBe(0.6); // 3 out of 5
  });

  it('validates cover letter word count (180-230 words) and unbanked facts', () => {
    const validOpening = 'Stripe is looking for a Staff Backend Engineer to lead high-throughput payment architectures.';
    const validProofPoints = [
      'At Amdocs, I led the distributed SaaS platform for millions of subscribers, achieving a 40% latency reduction in query response times.',
      'In the Smriti AI project, I built a zero-fabrication retrieval architecture supporting sub-200ms semantic search over 768-dimensional vectors.'
    ];

    // Build ~200 word letter
    const body = `Dear Hiring Team,\n\nI am applying for the Staff Backend Engineer role at Stripe. ${validOpening}\n\nOver the past 8.5 years, I have specialized in distributed systems, event-driven streaming with Apache Kafka, and resilient high-throughput microservices. ${validProofPoints[0]} Additionally, ${validProofPoints[1]}\n\nWhile my primary focus has been Java, Python, and Kafka, I note your requirement for Go; I have strong systems fundamentals and transition quickly between modern typed backend languages without compromising architectural rigor.\n\nI welcome the opportunity to discuss how my backend and distributed systems experience can support Stripe's infrastructure.\n\nSincerely,\nManish Kumar Prajapati`;

    const wordCount = body.trim().split(/\s+/).length;
    expect(wordCount).toBeGreaterThanOrEqual(100);

    const result = validateCoverLetter(body, [
      ...allAchievements,
      {
        id: 'ach_smriti',
        employerOrProject: 'Smriti',
        claim: 'AI zero-fabrication retrieval architecture',
        metric: 'sub-200ms semantic search over 768-dimensional vectors',
        period: '2023 - 2024',
        evidence: 'Smriti AI repo',
        skills: ['Python', 'TypeScript', 'Vector Databases'],
      }
    ]);

    expect(result.valid).toBe(true);
  });
});
