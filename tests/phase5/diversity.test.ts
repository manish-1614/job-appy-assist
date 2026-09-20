import { describe, it, expect } from 'vitest';
import { applyEmployerDiversityCap } from '../../lib/diversity';
import { EvaluatedJob } from '../../lib/ats-adapters';

function createMockJob(id: string, company: string, score: number): EvaluatedJob {
  return {
    id,
    title: `Software Engineer at ${company}`,
    company,
    location: 'Remote',
    score,
    tier: score >= 75 ? 'tier_a' : 'tier_b',
    salary: 'Salary not stated',
    sponsorship: 'unconfirmed',
    isRemote: true,
    matchReason: 'Match',
    evidence: [],
    techStack: ['Java'],
    postedAgo: 'Today',
    source: 'ats',
    canonicalUrl: `https://example.com/jobs/${id}`,
    status: 'open',
    firstSeenAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  };
}

describe('Employer Diversity Cap', () => {
  it('caps any single employer at <= 20% in top 50 list when >= 5 employers exist', () => {
    // 40 Datadog jobs with high scores (90-80)
    const datadogJobs: EvaluatedJob[] = [];
    for (let i = 0; i < 40; i++) {
      datadogJobs.push(createMockJob(`dd-${i}`, 'Datadog', 90 - i * 0.1));
    }

    // 15 Stripe jobs with good scores (85-75)
    const stripeJobs: EvaluatedJob[] = [];
    for (let i = 0; i < 15; i++) {
      stripeJobs.push(createMockJob(`stripe-${i}`, 'Stripe', 85 - i * 0.1));
    }

    // 10 Vercel jobs with decent scores (78-70)
    const vercelJobs: EvaluatedJob[] = [];
    for (let i = 0; i < 10; i++) {
      vercelJobs.push(createMockJob(`vercel-${i}`, 'Vercel', 78 - i * 0.1));
    }

    // 10 GitLab jobs with decent scores (75-65)
    const gitlabJobs: EvaluatedJob[] = [];
    for (let i = 0; i < 10; i++) {
      gitlabJobs.push(createMockJob(`gitlab-${i}`, 'GitLab', 75 - i * 0.1));
    }

    // 10 Supabase jobs with decent scores (72-62)
    const supabaseJobs: EvaluatedJob[] = [];
    for (let i = 0; i < 10; i++) {
      supabaseJobs.push(createMockJob(`supabase-${i}`, 'Supabase', 72 - i * 0.1));
    }

    const allJobs = [
      ...datadogJobs,
      ...stripeJobs,
      ...vercelJobs,
      ...gitlabJobs,
      ...supabaseJobs,
    ].sort((a, b) => b.score - a.score);

    const capped = applyEmployerDiversityCap(allJobs, 50, 0.20);
    expect(capped).toHaveLength(50);

    // Count by company
    const counts: Record<string, number> = {};
    for (const j of capped) {
      counts[j.company] = (counts[j.company] || 0) + 1;
    }

    // With limit 50 and 20% max share: maxAllowed = 10 (20% of 50)
    expect(counts['Datadog']).toBe(10);
    expect(counts['Stripe']).toBe(10);
    expect(counts['Vercel']).toBe(10);
    expect(counts['GitLab']).toBe(10);
    expect(counts['Supabase']).toBe(10);

    // Datadog share is exactly 20% (10 / 50)
    expect(counts['Datadog'] / 50).toBeLessThanOrEqual(0.20);
  });

  it('strictly rejects excess jobs for dominating employer when fewer employers exist', () => {
    // Only 2 employers
    const datadogJobs = Array.from({ length: 30 }, (_, i) => createMockJob(`dd-${i}`, 'Datadog', 90 - i));
    const stripeJobs = Array.from({ length: 5 }, (_, i) => createMockJob(`stripe-${i}`, 'Stripe', 85 - i));

    const capped = applyEmployerDiversityCap([...datadogJobs, ...stripeJobs], 50, 0.20, false);
    
    // Datadog is capped at 10, Stripe has 5 -> total 15
    const counts: Record<string, number> = {};
    for (const j of capped) counts[j.company] = (counts[j.company] || 0) + 1;

    expect(counts['Datadog']).toBe(10);
    expect(counts['Stripe']).toBe(5);
    expect(capped.length).toBe(15);
  });
});
