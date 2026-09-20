import { NextResponse } from 'next/server';
import { loadScreeningAnswers } from '@/lib/kit/tailor';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const answers = loadScreeningAnswers();
    return NextResponse.json({ success: true, answers });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load screening answers' },
      { status: 500 }
    );
  }
}
