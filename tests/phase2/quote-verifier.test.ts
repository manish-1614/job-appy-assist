import { describe, it, expect } from 'vitest';
import {
  normalizeForSearch,
  isVerbatimSubstring,
  verifyExtractedFacts,
} from '@/lib/scorer/quote-verifier';
import { ExtractedJobFacts } from '@/lib/scorer/types';

describe('Quote Verifier (Zero Fabrication)', () => {
  const sampleJd = `
    We are looking for a Senior Staff Backend Engineer to join our Distributed Systems team.
    Location: Worldwide Remote.
    Compensation: $180,000 - $220,000 USD per year.
    Requirements:
    - 8+ years of experience designing high-throughput microservices
    - Deep expertise in Java, Kafka, and PostgreSQL
    - Nice to have: Experience with Kubernetes and Vector Databases
    - Visa sponsorship is explicitly provided for eligible candidates relocating to Tokyo.
    - We require 4 hours of overlap with US Pacific working hours.
  `;

  const sampleTitle = 'Senior Staff Backend Engineer';
  const sampleLocation = 'Worldwide Remote';

  it('normalizes whitespace and casing correctly', () => {
    expect(normalizeForSearch('  Hello \n\t World\u00A0 ')).toBe('hello world');
    expect(normalizeForSearch(null)).toBe('');
    expect(normalizeForSearch('')).toBe('');
  });

  it('detects verbatim substrings accurately across sources', () => {
    expect(isVerbatimSubstring('Worldwide Remote', [sampleJd, sampleTitle, sampleLocation])).toBe(true);
    expect(isVerbatimSubstring('8+ years of experience', [sampleJd])).toBe(true);
    expect(isVerbatimSubstring('high-throughput microservices', [sampleJd])).toBe(true);
    expect(isVerbatimSubstring('Fabricated Claim That Never Existed', [sampleJd])).toBe(false);
  });

  it('verifies genuine extracted facts and preserves them', () => {
    const rawFacts: ExtractedJobFacts = {
      remoteScope: 'worldwide',
      allowedCountries: [],
      excludedCountries: [],
      tzOverlap: '4 hours overlap with US Pacific',
      engagement: 'employee',
      salary: { min: 180000, max: 220000, currency: 'USD', period: 'yearly' },
      visaSponsorship: 'explicit',
      seniority: 'staff_principal',
      roleFamily: 'backend_distributed',
      mustHaveTech: ['Java', 'Kafka', 'PostgreSQL'],
      niceToHaveTech: ['Kubernetes'],
      yearsRequired: 8,
      domainTags: ['Distributed Systems'],
      presales: false,
      quotes: {
        remoteScope: 'Worldwide Remote',
        tzOverlap: '4 hours of overlap with US Pacific',
        salary: '$180,000 - $220,000 USD',
        visaSponsorship: 'Visa sponsorship is explicitly provided',
        seniority: 'Senior Staff Backend Engineer',
        yearsRequired: '8+ years of experience',
        domainTags: 'Distributed Systems team',
      },
    };

    const verified = verifyExtractedFacts(rawFacts, {
      jdText: sampleJd,
      title: sampleTitle,
      location: sampleLocation,
    });

    expect(verified.remoteScope).toBe('worldwide');
    expect(verified.salary).toEqual({ min: 180000, max: 220000, currency: 'USD', period: 'yearly' });
    expect(verified.visaSponsorship).toBe('explicit');
    expect(verified.seniority).toBe('staff_principal');
    expect(verified.yearsRequired).toBe(8);
    expect(verified.mustHaveTech).toContain('Java');
    expect(verified.mustHaveTech).toContain('Kafka');
  });

  it('drops hallucinated fields and downgrades to unknown/null per zero-fabrication directive', () => {
    const hallucinatedFacts: ExtractedJobFacts = {
      remoteScope: 'worldwide',
      allowedCountries: ['France'],
      excludedCountries: [],
      tzOverlap: 'EST 9am-5pm mandatory',
      engagement: 'contractor',
      salary: { min: 90000, max: 120000, currency: 'EUR', period: 'yearly' },
      visaSponsorship: 'explicit',
      seniority: 'junior',
      roleFamily: 'architect',
      mustHaveTech: ['Rust', 'Cobol', 'Fortran', 'Java'], // only Java is in JD
      niceToHaveTech: ['Haskell'],
      yearsRequired: 2,
      domainTags: ['Cryptocurrency'],
      presales: true,
      quotes: {
        remoteScope: 'Only remote within France', // Not in JD!
        tzOverlap: 'Mandatory EST schedule', // Not in JD!
        salary: 'Salary not stated (Standard Senior Scale)', // F13 template string!
        visaSponsorship: 'Sponsorship is available everywhere', // Not in JD!
        seniority: 'Entry level junior position', // Not in JD!
        yearsRequired: 'Requires 2 years only', // Not in JD!
        presales: 'Client facing pre-sales activities', // Not in JD!
      },
    };

    const verified = verifyExtractedFacts(hallucinatedFacts, {
      jdText: sampleJd,
      title: sampleTitle,
      location: sampleLocation,
    });

    // Remote scope dropped to unknown because quote was hallucinated
    expect(verified.remoteScope).toBe('unknown');
    // Salary dropped to null
    expect(verified.salary).toBeNull();
    // Sponsorship dropped to unknown
    expect(verified.visaSponsorship).toBe('unknown');
    // Seniority dropped to unknown
    expect(verified.seniority).toBe('unknown');
    // Years required dropped to null
    expect(verified.yearsRequired).toBeNull();
    // Timezone overlap dropped to null
    expect(verified.tzOverlap).toBeNull();
    // Presales dropped to false
    expect(verified.presales).toBe(false);

    // Tech: Rust, Cobol, Fortran dropped; only Java retained
    expect(verified.mustHaveTech).toContain('Java');
    expect(verified.mustHaveTech).not.toContain('Rust');
    expect(verified.mustHaveTech).not.toContain('Cobol');
    expect(verified.mustHaveTech).not.toContain('Fortran');
    expect(verified.niceToHaveTech).not.toContain('Haskell');
  });
});
