import { describe, it, expect } from 'vitest';
import { passesDeterministicGate } from '@/lib/ai-evaluator';
import { RawJobPosting } from '@/lib/ats-adapters';

describe('Characterization: Deterministic Gate (lib/ai-evaluator.ts)', () => {
  function makeRawJob(title: string): RawJobPosting {
    return {
      source: 'greenhouse',
      externalId: '1001',
      title,
      company: 'Acme Corp',
      location: 'Remote',
      applyUrl: 'https://example.com/apply',
      sourceType: 'ats',
    };
  }

  it('allows senior, staff, principal roles to pass', () => {
    expect(passesDeterministicGate(makeRawJob('Senior Backend Engineer'))).toBe(true);
    expect(passesDeterministicGate(makeRawJob('Staff Distributed Systems Engineer'))).toBe(true);
    expect(passesDeterministicGate(makeRawJob('Principal Software Architect'))).toBe(true);
  });

  it('drops explicit junior and intern titles', () => {
    expect(passesDeterministicGate(makeRawJob('Junior Software Developer'))).toBe(false);
    expect(passesDeterministicGate(makeRawJob('Summer Software Engineering Intern'))).toBe(false);
    expect(passesDeterministicGate(makeRawJob('Graduate Engineer Trainee'))).toBe(false);
    expect(passesDeterministicGate(makeRawJob('Frontend Only Developer'))).toBe(false);
  });

  it('verifies F2 resolved: word-boundary matching allows "Internal Tools" and "International"', () => {
    // F2 resolved: word-boundary regex allows internal and international engineering roles
    expect(passesDeterministicGate(makeRawJob('Software Engineer, Internal Tools'))).toBe(true);
    expect(passesDeterministicGate(makeRawJob('International Expansion Engineer'))).toBe(true);
  });
});
