import { NextResponse } from 'next/server';
import { loadCanonicalJobs, saveCanonicalJobs, addCompany, loadCompanies } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, jobId, targetJobId, companyName, ats, slug } = body;

    if (!action || !jobId) {
      return NextResponse.json({ success: false, error: 'Missing required parameters: action, jobId' }, { status: 400 });
    }

    const jobs = loadCanonicalJobs();
    const job = jobs.find(j => j.id === jobId);

    if (action === 'merge') {
      if (!job) {
        return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
      }

      const target = jobs.find(j => j.id === targetJobId);
      if (target) {
        target.evidence.push(`Merged Source Corroboration from #${job.id}: ${job.source}`);
        target.sourcesCount = (target.sourcesCount || 1) + 1;
      }
      job.status = 'closed';
      saveCanonicalJobs(jobs);

      return NextResponse.json({
        success: true,
        message: `Successfully merged job #${jobId} into parent job #${targetJobId || 'target'}. Source evidence attached.`,
        action: 'merge',
        resolvedJobId: jobId,
      });
    }

    if (action === 'confirm_distinct') {
      if (!job) {
        return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
      }
      job.status = 'open';
      job.possibleDuplicateOf = undefined;
      saveCanonicalJobs(jobs);

      return NextResponse.json({
        success: true,
        message: `Confirmed job #${jobId} as distinct opening. Status updated to 'open'.`,
        action: 'confirm_distinct',
        resolvedJobId: jobId,
      });
    }

    if (action === 'add_watchlist') {
      if (!companyName) {
        return NextResponse.json({ success: false, error: 'Missing companyName for watchlist addition' }, { status: 400 });
      }

      const companies = loadCompanies();
      const existing = companies.find(c => c.name.toLowerCase() === companyName.toLowerCase());
      if (!existing) {
        addCompany({
          name: companyName,
          ats: ats || 'greenhouse',
          slug: slug || companyName.toLowerCase().replace(/[^a-z0-9]/g, ''),
          careersUrl: '',
          priority: 2,
          isActive: true
        });
      }

      return NextResponse.json({
        success: true,
        message: `Employer '${companyName}' added to Watchlist for direct ATS polling.`,
        action: 'add_watchlist',
        companyName,
      });
    }

    return NextResponse.json({ success: false, error: `Invalid action '${action}'` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Failed to process review queue action' }, { status: 500 });
  }
}
