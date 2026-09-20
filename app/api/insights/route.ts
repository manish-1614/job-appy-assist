import { NextResponse } from 'next/server';
import { getFunnelInsights } from '@/lib/applications';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const insights = getFunnelInsights();
    return NextResponse.json({ success: true, insights });
  } catch (err: any) {
    console.error('Error in insights API:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}
