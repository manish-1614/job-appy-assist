import { NextRequest, NextResponse } from 'next/server';
import { tailorApplicationKit } from '@/lib/kit/tailor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const kit = tailorApplicationKit(jobId);
    return NextResponse.json({ success: true, kit });
  } catch (err: any) {
    console.error('Error tailoring application kit:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to tailor application kit' },
      { status: 500 }
    );
  }
}
