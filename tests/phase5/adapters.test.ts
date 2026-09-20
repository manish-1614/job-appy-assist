import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWorkableJobs, fetchRecruiteeJobs } from '../../lib/ats-adapters';

describe('Phase 5 Adapters', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('correctly maps Workable widget API response', async () => {
    const mockWorkableData = {
      name: 'Resend',
      jobs: [
        {
          id: 101,
          shortcode: 'RES101',
          title: 'Senior Backend Engineer',
          city: 'Tokyo',
          country: 'Japan',
          telecommuting: true,
          url: 'https://apply.workable.com/resend/j/RES101/',
          description: 'Building modern email APIs in Go and Node.',
          created_at: '2026-09-18T10:00:00Z',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockWorkableData,
    } as any);

    const jobs = await fetchWorkableJobs('resend', 'Resend');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe('Resend');
    expect(jobs[0].title).toBe('Senior Backend Engineer');
    expect(jobs[0].location).toBe('Remote');
    expect(jobs[0].externalId).toBe('RES101');
    expect(jobs[0].applyUrl).toBe('https://apply.workable.com/resend/j/RES101/');
  });

  it('correctly maps Recruitee public offers API response', async () => {
    const mockRecruiteeData = {
      offers: [
        {
          id: 202,
          slug: 'senior-platform-engineer',
          title: 'Senior Platform Engineer',
          location: 'London, UK',
          remote: true,
          careers_url: 'https://monzo.recruitee.com/o/senior-platform-engineer',
          description: 'Distributed banking systems on Kubernetes and Go.',
          published_at: '2026-09-19T08:00:00Z',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRecruiteeData,
    } as any);

    const jobs = await fetchRecruiteeJobs('monzo', 'Monzo');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].company).toBe('Monzo');
    expect(jobs[0].title).toBe('Senior Platform Engineer');
    expect(jobs[0].location).toBe('Remote');
    expect(jobs[0].externalId).toBe('202');
    expect(jobs[0].applyUrl).toBe('https://monzo.recruitee.com/o/senior-platform-engineer');
  });
});
