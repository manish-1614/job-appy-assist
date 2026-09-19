import { NextResponse } from 'next/server';
import { listScanHistory } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const history = await listScanHistory();
    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
