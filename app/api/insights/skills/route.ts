import { NextResponse } from 'next/server';
import { aggregateSkillGaps } from '@/lib/skill-gap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = aggregateSkillGaps();
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error('Failed aggregating skill gaps:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to aggregate skill gaps' },
      { status: 500 }
    );
  }
}
