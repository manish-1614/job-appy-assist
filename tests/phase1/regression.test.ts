import { describe, it, expect } from 'vitest';
import { canonicalizeUrl, checkJobDeduplication } from '@/lib/dedup';
import { passesDeterministicGate } from '@/lib/ai-evaluator';
import { RawJobPosting } from '@/lib/ats-adapters';

describe('Phase 1 Bug Reproduction Tests (Failing before fix)', () => {
  describe('F1: Stripe URL collapse via gh_jid stripping', () => {
    it('must retain gh_jid so company-hosted Greenhouse URLs remain distinct', () => {
      const stripeUrl1 = 'https://stripe.com/jobs/search?gh_jid=5678123';
      const stripeUrl2 = 'https://stripe.com/jobs/search?gh_jid=5678124';

      const canonical1 = canonicalizeUrl(stripeUrl1);
      const canonical2 = canonicalizeUrl(stripeUrl2);

      // In fixed implementation, gh_jid MUST be preserved
      expect(canonical1).toContain('gh_jid=5678123');
      expect(canonical2).toContain('gh_jid=5678124');
      expect(canonical1).not.toBe(canonical2);
    });

    it('must strip marketing tracking params while keeping gh_jid', () => {
      const complexUrl = 'https://stripe.com/jobs/search?gh_jid=5678123&utm_source=linkedin&utm_campaign=eng';
      const canonical = canonicalizeUrl(complexUrl);

      expect(canonical).toContain('gh_jid=5678123');
      expect(canonical).not.toContain('utm_source');
      expect(canonical).not.toContain('utm_campaign');
    });
  });

  describe('F2: Deterministic Gate word-boundary matching', () => {
    function createJob(title: string): RawJobPosting {
      return {
        source: 'greenhouse',
        externalId: '101',
        title,
        company: 'Stripe',
        location: 'Remote - India',
        applyUrl: 'https://example.com',
        sourceType: 'ats',
      };
    }

    it('must allow legitimate engineering titles with "internal" or "international"', () => {
      expect(passesDeterministicGate(createJob('Software Engineer, Internal Tools'))).toBe(true);
      expect(passesDeterministicGate(createJob('Staff Engineer, International Payments'))).toBe(true);
      expect(passesDeterministicGate(createJob('Senior Systems Engineer - Internal Platform'))).toBe(true);
    });

    it('must continue to drop genuine junior and intern roles', () => {
      expect(passesDeterministicGate(createJob('Software Engineering Intern'))).toBe(false);
      expect(passesDeterministicGate(createJob('Summer 2026 Intern - Backend'))).toBe(false);
      expect(passesDeterministicGate(createJob('Junior Backend Developer'))).toBe(false);
    });
  });

  describe('F11: Dedup v2 seniority & location differentiation', () => {
    it('must NOT flag Bangalore vs Remote-US roles as duplicates even with similar titles', () => {
      const existing = [
        {
          id: 'job-trust-us',
          company: 'Stripe',
          title: 'Senior Staff Software Engineer, Trust',
          canonicalUrl: 'https://stripe.com/jobs/search?gh_jid=1001',
          location: 'Remote - US',
        },
      ];

      const incoming = {
        company: 'Stripe',
        title: 'Senior SWE (AI/ML), Trust',
        applyUrl: 'https://stripe.com/jobs/search?gh_jid=1002',
        location: 'Bangalore, India',
      };

      const result = checkJobDeduplication(incoming, existing);
      expect(result.isPossibleDuplicate).toBe(false);
    });
  });
});
