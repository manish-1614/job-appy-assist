import { describe, it, expect } from 'vitest';
import {
  canonicalizeUrl,
  normalizeCompanyName,
  normalizeJobTitle,
  calculateTitleSimilarity,
  checkJobDeduplication,
} from '@/lib/dedup';

describe('Characterization: URL Canonicalization & Deduplication', () => {
  describe('canonicalizeUrl', () => {
    it('strips tracking params and lowercases hostname', () => {
      const url = 'https://Example.com/jobs/123/?utm_source=linkedin&utm_medium=cpc';
      expect(canonicalizeUrl(url)).toBe('https://example.com/jobs/123');
    });

    it('characterizes F1: currently strips gh_jid which causes Stripe URL collapse', () => {
      // In Phase 0 baseline, gh_jid is stripped by canonicalizeUrl
      const stripeUrl1 = 'https://stripe.com/jobs/search?gh_jid=123456';
      const stripeUrl2 = 'https://stripe.com/jobs/search?gh_jid=654321';
      expect(canonicalizeUrl(stripeUrl1)).toBe('https://stripe.com/jobs/search');
      expect(canonicalizeUrl(stripeUrl2)).toBe('https://stripe.com/jobs/search');
      // Both collapse to the same canonical URL in Phase 0
      expect(canonicalizeUrl(stripeUrl1)).toBe(canonicalizeUrl(stripeUrl2));
    });

    it('handles trailing slash normalization', () => {
      expect(canonicalizeUrl('https://boards.greenhouse.io/stripe/jobs/123/')).toBe(
        'https://boards.greenhouse.io/stripe/jobs/123'
      );
    });

    it('handles invalid URLs gracefully by trimming and lowercasing', () => {
      expect(canonicalizeUrl('not-a-valid-url/')).toBe('not-a-valid-url');
    });
  });

  describe('normalizeCompanyName', () => {
    it('removes legal suffixes and punctuation', () => {
      expect(normalizeCompanyName('Stripe, Inc.')).toBe('stripe');
      expect(normalizeCompanyName('Datadog Ltd.')).toBe('datadog');
      expect(normalizeCompanyName('Amdocs Corporation')).toBe('amdocs');
    });
  });

  describe('calculateTitleSimilarity', () => {
    it('calculates Jaccard similarity after removing seniority tokens', () => {
      // normalizeJobTitle strips senior, staff, lead, etc.
      const sim = calculateTitleSimilarity(
        'Senior Backend Engineer',
        'Staff Backend Engineer'
      );
      // Both reduce to 'backend engineer', so similarity is 1.0
      expect(sim).toBe(1.0);
    });
  });

  describe('checkJobDeduplication', () => {
    const existing = [
      {
        id: 'job-101',
        company: 'Stripe',
        title: 'Senior Staff Software Engineer, Trust',
        canonicalUrl: 'https://stripe.com/jobs/search',
      },
    ];

    it('identifies Level 1 exact URL match', () => {
      const result = checkJobDeduplication(
        {
          company: 'Stripe',
          title: 'Senior SWE (AI/ML), Trust',
          applyUrl: 'https://stripe.com/jobs/search?utm_source=twitter',
        },
        existing
      );

      expect(result.isExactUrlMatch).toBe(true);
      expect(result.matchedJobId).toBe('job-101');
    });

    it('identifies Level 2 fuzzy duplicate when company matches and title similarity >= 0.6', () => {
      const existingDiverse = [
        {
          id: 'job-201',
          company: 'Datadog',
          title: 'Staff Distributed Systems Engineer',
          canonicalUrl: 'https://boards.greenhouse.io/datadog/jobs/201',
        },
      ];

      const result = checkJobDeduplication(
        {
          company: 'Datadog, Inc.',
          title: 'Senior Distributed Systems Engineer',
          applyUrl: 'https://boards.greenhouse.io/datadog/jobs/301',
        },
        existingDiverse
      );

      expect(result.isExactUrlMatch).toBe(false);
      expect(result.isPossibleDuplicate).toBe(true);
      expect(result.matchedJobId).toBe('job-201');
    });

    it('returns clean new job when neither matches', () => {
      const result = checkJobDeduplication(
        {
          company: 'Anthropic',
          title: 'Staff Systems Engineer',
          applyUrl: 'https://jobs.lever.co/anthropic/999',
        },
        existing
      );

      expect(result.isExactUrlMatch).toBe(false);
      expect(result.isPossibleDuplicate).toBe(false);
      expect(result.confidenceScore).toBe(0);
    });
  });
});
