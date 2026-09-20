import { NextRequest, NextResponse } from 'next/server';
import { loadCanonicalJobs } from '@/lib/storage';
import { EvaluatedJob } from '@/lib/ats-adapters';

export const dynamic = 'force-dynamic';

export interface DistinctCompanyGroup {
  company: string;
  primaryJob: EvaluatedJob;
  otherJobs: EvaluatedJob[];
  totalJobsCount: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const distinct = searchParams.get('distinct') === 'true';
    const minScore = parseInt(searchParams.get('minScore') || '65', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const jobs = loadCanonicalJobs();

    if (!distinct) {
      return NextResponse.json({
        success: true,
        count: jobs.length,
        jobs,
      });
    }

    // Filter open qualifying jobs meeting the minimum relevance threshold
    const qualifyingJobs = jobs.filter(
      (j) => j.status === 'open' && j.score >= minScore
    );

    // Group by company (normalized lowercase)
    const companyMap = new Map<string, { companyName: string; jobs: EvaluatedJob[] }>();

    for (const job of qualifyingJobs) {
      const companyKey = (job.company || 'Unknown').trim().toLowerCase();
      if (!companyMap.has(companyKey)) {
        companyMap.set(companyKey, {
          companyName: job.company,
          jobs: [],
        });
      }
      companyMap.get(companyKey)!.jobs.push(job);
    }

    // Build distinct company groups with primary (highest score) and secondary jobs
    const distinctCompanies: DistinctCompanyGroup[] = [];

    for (const group of Array.from(companyMap.values())) {
      // Sort jobs within company by score descending, then by recency
      group.jobs.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        const timeB = new Date(b.firstSeenAt || 0).getTime();
        const timeA = new Date(a.firstSeenAt || 0).getTime();
        return timeB - timeA;
      });

      distinctCompanies.push({
        company: group.companyName,
        primaryJob: group.jobs[0],
        otherJobs: group.jobs.slice(1),
        totalJobsCount: group.jobs.length,
      });
    }

    // Sort company groups by best job score descending, then by recency
    distinctCompanies.sort((a, b) => {
      if (b.primaryJob.score !== a.primaryJob.score) {
        return b.primaryJob.score - a.primaryJob.score;
      }
      const timeB = new Date(b.primaryJob.firstSeenAt || 0).getTime();
      const timeA = new Date(a.primaryJob.firstSeenAt || 0).getTime();
      return timeB - timeA;
    });

    const paginatedCompanies = distinctCompanies.slice(0, limit);

    return NextResponse.json({
      success: true,
      count: paginatedCompanies.length,
      totalCompaniesCount: distinctCompanies.length,
      totalJobsCount: jobs.length,
      distinctCompanies: paginatedCompanies,
      jobs: paginatedCompanies.map((c) => c.primaryJob),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
