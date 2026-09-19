import { NextResponse } from 'next/server';
import { loadCanonicalJobs } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const jobs = loadCanonicalJobs();
    return NextResponse.json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
