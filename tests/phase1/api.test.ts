import { describe, it, expect } from 'vitest';
import { loadCanonicalJobs, loadCompanies, loadRunsHistory } from '@/lib/storage';

describe('Storage & API Integration with SQLite', () => {
  it('loadCanonicalJobs returns all open migrated jobs from SQLite', () => {
    const jobs = loadCanonicalJobs();
    expect(jobs.length).toBeGreaterThanOrEqual(1975);

    const openJobs = jobs.filter(j => j.status === 'open');
    expect(openJobs.length).toBeGreaterThanOrEqual(1800);

    // Verify Stripe jobs are present and open
    const stripeJobs = openJobs.filter(j => j.company === 'Stripe');
    expect(stripeJobs.length).toBeGreaterThan(0);
    expect(stripeJobs[0].status).toBe('open');
  });

  it('loadCompanies loads sources directly from SQLite', () => {
    const companies = loadCompanies();
    expect(companies.length).toBeGreaterThanOrEqual(14);
    const names = companies.map(c => c.name);
    expect(names).toContain('Stripe');
    expect(names).toContain('Datadog');
  });

  it('loadRunsHistory loads run history from SQLite', () => {
    const runs = loadRunsHistory();
    expect(runs.length).toBeGreaterThanOrEqual(4);
    expect(runs[0].sourcesChecked).toBeGreaterThan(0);
  });
});
