import { NextResponse } from 'next/server';
import { saveJobLabel, getAllJobLabels, getLabelStats, JobLabel } from '@/lib/labels';

export async function GET() {
  try {
    const labels = getAllJobLabels();
    const stats = getLabelStats();
    return NextResponse.json({
      success: true,
      stats,
      labels,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch labels' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, label, reasonCode, notes } = body;

    if (!jobId || !label || !reasonCode) {
      return NextResponse.json(
        { success: false, error: 'jobId, label, and reasonCode are required' },
        { status: 400 }
      );
    }

    const jobLabel: JobLabel = {
      jobId,
      label,
      reasonCode,
      notes: notes || null,
      labeledAt: new Date().toISOString(),
    };

    saveJobLabel(jobLabel);

    return NextResponse.json({
      success: true,
      saved: jobLabel,
      stats: getLabelStats(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save label' },
      { status: 500 }
    );
  }
}
