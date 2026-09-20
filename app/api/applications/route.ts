import { NextRequest, NextResponse } from 'next/server';
import { listApplications, trackJob, type ApplicationStatus } from '@/lib/applications';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') as ApplicationStatus | null;
    const search = searchParams.get('search') || undefined;

    const apps = listApplications({
      status: status || undefined,
      search,
    });

    return NextResponse.json({ success: true, applications: apps });
  } catch (err: any) {
    console.error('Error fetching applications:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to list applications' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, status, channel, notes, appliedAt, resumeVersionId, coverLetterId, contacts } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const app = trackJob(jobId, status || 'saved', {
      channel,
      notes,
      appliedAt,
      resumeVersionId,
      coverLetterId,
      contacts,
    });

    return NextResponse.json({ success: true, application: app });
  } catch (err: any) {
    console.error('Error tracking application:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to track application' },
      { status: 500 }
    );
  }
}
