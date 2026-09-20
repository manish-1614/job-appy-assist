import { NextResponse } from 'next/server';
import { getTodayCockpit } from '@/lib/applications';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = getTodayCockpit();
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    console.error('Error in today API:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch today cockpit' },
      { status: 500 }
    );
  }
}
