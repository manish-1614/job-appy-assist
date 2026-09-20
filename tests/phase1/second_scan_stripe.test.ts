import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sqlite } from '@/lib/db';
import { reconcileSourceScan, SourceScanResult } from '@/lib/lifecycle';
import { canonicalizeUrl } from '@/lib/dedup';

describe('Phase 1 Acceptance: Simulated Second Scan surfaces new Stripe job (F1)', () => {
  const testAts = 'greenhouse';
  const testSlug = 'stripe-sim';
  const testSourceId = `${testAts}:${testSlug}`;

  beforeAll(() => {
    // Register simulated source
    sqlite.prepare('DELETE FROM job_events WHERE job_id LIKE ?').run(`${testAts}:${testSlug}:%`);
    sqlite.prepare('DELETE FROM jobs WHERE ats = ? AND slug = ?').run(testAts, testSlug);
    sqlite.prepare('DELETE FROM sources WHERE ats = ? AND slug = ?').run(testAts, testSlug);

    sqlite.prepare(`
      INSERT INTO sources (id, ats, slug, name, active, last_job_count, created_at)
      VALUES (?, ?, ?, 'Stripe Simulated', 1, 0, '2026-09-20T00:00:00.000Z')
    `).run(testSourceId, testAts, testSlug);
  });

  afterAll(() => {
    // Cleanup test fixtures
    sqlite.prepare('DELETE FROM job_events WHERE job_id LIKE ?').run(`${testAts}:${testSlug}:%`);
    sqlite.prepare('DELETE FROM jobs WHERE ats = ? AND slug = ?').run(testAts, testSlug);
    sqlite.prepare('DELETE FROM sources WHERE ats = ? AND slug = ?').run(testAts, testSlug);
  });

  it('detects a new Stripe job with distinct gh_jid on a subsequent scan', () => {
    const existingStripeUrl = 'https://stripe.com/jobs/search?gh_jid=7601663';
    const newStripeUrl = 'https://stripe.com/jobs/search?gh_jid=8999999';

    // Verify canonical URLs are distinct and retain gh_jid
    expect(canonicalizeUrl(existingStripeUrl)).not.toBe(canonicalizeUrl(newStripeUrl));
    expect(canonicalizeUrl(newStripeUrl)).toContain('gh_jid=8999999');

    // --- Simulated Scan 1: Baseline with initial job ---
    const scan1: SourceScanResult = {
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Stripe Simulated',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: '7601663',
          title: 'Solutions Architect, Enterprise',
          company: 'Stripe',
          location: 'Remote - India',
          canonicalUrl: existingStripeUrl,
          applyUrl: existingStripeUrl,
          score: 85,
          matchReason: 'Enterprise architecture match',
        },
      ],
    };

    const summary1 = reconcileSourceScan(scan1, '2026-09-20T10:00:00.000Z');
    expect(summary1.newJobsCount).toBe(1);

    // --- Simulated Scan 2: Second scan containing the existing job AND a brand new Stripe job ---
    const scan2: SourceScanResult = {
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Stripe Simulated',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: '7601663',
          title: 'Solutions Architect, Enterprise',
          company: 'Stripe',
          location: 'Remote - India',
          canonicalUrl: existingStripeUrl,
          applyUrl: existingStripeUrl,
          score: 85,
        },
        {
          ats: testAts,
          slug: testSlug,
          externalId: '8999999',
          title: 'Staff Software Engineer, Global Ledger Systems',
          company: 'Stripe',
          location: 'Remote - India',
          canonicalUrl: newStripeUrl,
          applyUrl: newStripeUrl,
          score: 95,
          matchReason: 'Direct overlap with distributed systems and ledger architecture',
        },
      ],
    };

    const summary2 = reconcileSourceScan(scan2, '2026-09-20T12:00:00.000Z');

    // F1 Verification: The new Stripe role MUST NOT be swallowed by canonical URL collapse!
    expect(summary2.newJobsCount).toBe(1);
    expect(summary2.updatedJobsCount).toBe(1);

    // Verify both jobs exist in SQLite with open status
    const initialJob = sqlite
      .prepare('SELECT * FROM jobs WHERE id = ?')
      .get(`${testAts}:${testSlug}:7601663`) as any;
    const newJob = sqlite
      .prepare('SELECT * FROM jobs WHERE id = ?')
      .get(`${testAts}:${testSlug}:8999999`) as any;

    expect(initialJob).toBeDefined();
    expect(initialJob.status).toBe('open');

    expect(newJob).toBeDefined();
    expect(newJob.title).toBe('Staff Software Engineer, Global Ledger Systems');
    expect(newJob.status).toBe('open');
    expect(newJob.canonical_url).toContain('gh_jid=8999999');
  });
});
