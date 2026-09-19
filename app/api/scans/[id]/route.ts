import { NextResponse } from 'next/server';
import { getScanById } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const scanRecord = await getScanById(params.id);
    if (!scanRecord) {
      return NextResponse.json({ success: false, error: 'Scan record not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, scan: scanRecord });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
