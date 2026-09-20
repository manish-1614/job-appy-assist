import { describe, it, expect } from 'vitest';
import { sqlite, db } from '@/lib/db';
import { sources, jobs } from '@/lib/db/schema';

describe('SQLite & Drizzle Storage Layer', () => {
  it('initializes tables in SQLite database', () => {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('sources');
    expect(tableNames).toContain('jobs');
    expect(tableNames).toContain('job_descriptions');
    expect(tableNames).toContain('job_events');
    expect(tableNames).toContain('runs');
  });

  it('allows querying sources and jobs via Drizzle', () => {
    const allSources = db.select().from(sources).all();
    expect(Array.isArray(allSources)).toBe(true);

    const allJobs = db.select().from(jobs).all();
    expect(Array.isArray(allJobs)).toBe(true);
  });
});
