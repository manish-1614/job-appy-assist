import { describe, it, expect, beforeEach } from 'vitest';
import { sqlite } from '@/lib/db';
import { reconcileSourceScan, SourceScanResult } from '@/lib/lifecycle';

describe('Phase 1 Job Lifecycle & Staleness Engine (F5, F6)', () => {
  const testAts = 'testats';
  const testSlug = 'lifecycleco';
  const testSourceId = `${testAts}:${testSlug}`;

  beforeEach(() => {
    // Setup test source in sources table
    sqlite.prepare('DELETE FROM job_events WHERE job_id LIKE ?').run(`${testAts}:${testSlug}:%`);
    sqlite.prepare('DELETE FROM job_descriptions WHERE job_id LIKE ?').run(`${testAts}:${testSlug}:%`);
    sqlite.prepare('DELETE FROM jobs WHERE ats = ? AND slug = ?').run(testAts, testSlug);
    sqlite.prepare('DELETE FROM sources WHERE ats = ? AND slug = ?').run(testAts, testSlug);

    sqlite.prepare(`
      INSERT INTO sources (id, ats, slug, name, active, last_job_count, created_at)
      VALUES (?, ?, ?, ?, 1, 2, '2026-09-20T00:00:00.000Z')
    `).run(testSourceId, testAts, testSlug, 'Lifecycle Co');
  });

  it('Scan 1: discovers new jobs with open status and consecutive_missing_scans = 0', () => {
    const scan1: SourceScanResult = {
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-1',
          title: 'Staff Systems Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/1',
          applyUrl: 'https://lifecycle.co/jobs/1',
          contentHtml: '<p>Distributed systems in Go and Kafka.</p>',
        },
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-2',
          title: 'Senior Backend Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/2',
          applyUrl: 'https://lifecycle.co/jobs/2',
        },
      ],
    };

    const summary = reconcileSourceScan(scan1, '2026-09-20T10:00:00.000Z');
    expect(summary.newJobsCount).toBe(2);

    const job1 = sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(`${testAts}:${testSlug}:job-1`) as any;
    expect(job1.status).toBe('open');
    expect(job1.consecutive_missing_scans).toBe(0);
    expect(job1.first_seen_at).toBe('2026-09-20T10:00:00.000Z');
    expect(job1.last_seen_at).toBe('2026-09-20T10:00:00.000Z');

    // Verify JD text persisted
    const desc = sqlite.prepare('SELECT * FROM job_descriptions WHERE job_id = ?').get(`${testAts}:${testSlug}:job-1`) as any;
    expect(desc.description_text).toContain('Distributed systems in Go and Kafka.');
  });

  it('Scan 2: missing job gets consecutive_missing_scans = 1, status remains open (grace period)', () => {
    // Populate job-1 and job-2
    reconcileSourceScan({
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-1',
          title: 'Staff Systems Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/1',
          applyUrl: 'https://lifecycle.co/jobs/1',
        },
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-2',
          title: 'Senior Backend Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/2',
          applyUrl: 'https://lifecycle.co/jobs/2',
        },
      ],
    }, '2026-09-20T10:00:00.000Z');

    // Scan 2: job-2 is missing, only job-1 observed
    const scan2: SourceScanResult = {
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-1',
          title: 'Staff Systems Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/1',
          applyUrl: 'https://lifecycle.co/jobs/1',
        },
      ],
    };

    const summary = reconcileSourceScan(scan2, '2026-09-20T12:00:00.000Z');
    expect(summary.missingIncrementCount).toBe(1);
    expect(summary.closedJobsCount).toBe(0);

    const job2 = sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(`${testAts}:${testSlug}:job-2`) as any;
    expect(job2.status).toBe('open'); // Still open!
    expect(job2.consecutive_missing_scans).toBe(1);
  });

  it('Scan 3: second consecutive missing scan closes the job', () => {
    // Populate job-1 and job-2
    reconcileSourceScan({
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-1',
          title: 'Staff Systems Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/1',
          applyUrl: 'https://lifecycle.co/jobs/1',
        },
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-2',
          title: 'Senior Backend Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/2',
          applyUrl: 'https://lifecycle.co/jobs/2',
        },
      ],
    }, '2026-09-20T10:00:00.000Z');

    // Scan 2 (job-2 missing -> missing count 1)
    reconcileSourceScan({
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-1',
          title: 'Staff Systems Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/1',
          applyUrl: 'https://lifecycle.co/jobs/1',
        },
      ],
    }, '2026-09-20T12:00:00.000Z');

    // Scan 3 (job-2 missing again -> missing count 2 -> CLOSED!)
    const summary3 = reconcileSourceScan({
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-1',
          title: 'Staff Systems Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/1',
          applyUrl: 'https://lifecycle.co/jobs/1',
        },
      ],
    }, '2026-09-20T14:00:00.000Z');

    expect(summary3.closedJobsCount).toBe(1);

    const job2 = sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(`${testAts}:${testSlug}:job-2`) as any;
    expect(job2.status).toBe('closed');
    expect(job2.consecutive_missing_scans).toBe(2);

    // Verify closed event logged in job_events
    const event = sqlite
      .prepare("SELECT * FROM job_events WHERE job_id = ? AND event_type = 'closed'")
      .get(`${testAts}:${testSlug}:job-2`) as any;
    expect(event).toBeDefined();
  });

  it('Scan 4: reopening when a closed job returns', () => {
    // Manually close job-2
    sqlite.prepare(`
      INSERT INTO jobs (id, ats, slug, external_id, title, company, location, canonical_url, apply_url, status, consecutive_missing_scans, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, 'job-2', 'Senior Backend Engineer', 'Lifecycle Co', 'Remote', 'https://lifecycle.co/jobs/2', 'https://lifecycle.co/jobs/2', 'closed', 2, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')
    `).run(`${testAts}:${testSlug}:job-2`, testAts, testSlug);

    // Sighted in new scan
    const summary = reconcileSourceScan({
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 200,
      isSuccess: true,
      observedJobs: [
        {
          ats: testAts,
          slug: testSlug,
          externalId: 'job-2',
          title: 'Senior Backend Engineer',
          company: 'Lifecycle Co',
          location: 'Remote',
          canonicalUrl: 'https://lifecycle.co/jobs/2',
          applyUrl: 'https://lifecycle.co/jobs/2',
        },
      ],
    }, '2026-09-20T16:00:00.000Z');

    expect(summary.reopenedJobsCount).toBe(1);

    const job2 = sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(`${testAts}:${testSlug}:job-2`) as any;
    expect(job2.status).toBe('open');
    expect(job2.consecutive_missing_scans).toBe(0);
    expect(job2.last_seen_at).toBe('2026-09-20T16:00:00.000Z');

    // Verify reopened event logged
    const event = sqlite
      .prepare("SELECT * FROM job_events WHERE job_id = ? AND event_type = 'reopened'")
      .get(`${testAts}:${testSlug}:job-2`) as any;
    expect(event).toBeDefined();
  });

  it('Source failure / 0-fetch guard: does NOT close open jobs on failed or empty fetch', () => {
    // Seed open job
    sqlite.prepare(`
      INSERT INTO jobs (id, ats, slug, external_id, title, company, location, canonical_url, apply_url, status, consecutive_missing_scans, first_seen_at, last_seen_at)
      VALUES (?, ?, ?, 'job-1', 'Staff Systems Engineer', 'Lifecycle Co', 'Remote', 'https://lifecycle.co/jobs/1', 'https://lifecycle.co/jobs/1', 'open', 1, '2026-09-20T00:00:00Z', '2026-09-20T00:00:00Z')
    `).run(`${testAts}:${testSlug}:job-1`, testAts, testSlug);

    // Failed source fetch (e.g. 500 or rate limited)
    const failedScan: SourceScanResult = {
      sourceId: testSourceId,
      ats: testAts,
      slug: testSlug,
      name: 'Lifecycle Co',
      httpStatus: 500,
      isSuccess: false,
      observedJobs: [],
      errorMessage: 'Gateway Timeout',
    };

    const summary = reconcileSourceScan(failedScan);
    expect(summary.skippedUnhealthySourcesCount).toBe(1);
    expect(summary.closedJobsCount).toBe(0);

    // Job must still be open with untouched missing scans
    const job1 = sqlite.prepare('SELECT * FROM jobs WHERE id = ?').get(`${testAts}:${testSlug}:job-1`) as any;
    expect(job1.status).toBe('open');
    expect(job1.consecutive_missing_scans).toBe(1);
  });
});
