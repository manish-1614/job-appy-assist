import { describe, it, expect } from 'vitest';
import { sqlite } from '@/lib/db';

describe('Phase 1 Migration Acceptance Criteria', () => {
  it('has at least 1,975 migrated jobs in SQLite', () => {
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
    expect(row.count).toBeGreaterThanOrEqual(1975);
  });

  it('has zero jobs with NULL status', () => {
    const row = sqlite.prepare('SELECT COUNT(*) as count FROM jobs WHERE status IS NULL').get() as { count: number };
    expect(row.count).toBe(0);
  });

  it('has zero jobs with NULL firstSeenAt or lastSeenAt', () => {
    const firstSeenRow = sqlite.prepare('SELECT COUNT(*) as count FROM jobs WHERE first_seen_at IS NULL').get() as { count: number };
    const lastSeenRow = sqlite.prepare('SELECT COUNT(*) as count FROM jobs WHERE last_seen_at IS NULL').get() as { count: number };
    expect(firstSeenRow.count).toBe(0);
    expect(lastSeenRow.count).toBe(0);
  });

  it('contains legacy Stripe jobs that were previously invisible due to missing status', () => {
    const stripeOpenJobs = sqlite.prepare("SELECT COUNT(*) as count FROM jobs WHERE company = 'Stripe' AND status = 'open'").get() as { count: number };
    expect(stripeOpenJobs.count).toBeGreaterThan(0);
  });

  it('migrates all 14 active sources and historical runs', () => {
    const sourcesRow = sqlite.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number };
    const runsRow = sqlite.prepare('SELECT COUNT(*) as count FROM runs').get() as { count: number };
    expect(sourcesRow.count).toBeGreaterThanOrEqual(14);
    expect(runsRow.count).toBeGreaterThanOrEqual(3);
  });
});
