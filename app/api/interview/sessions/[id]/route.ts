import { NextRequest, NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = sqlite
      .prepare(`SELECT * FROM interview_sessions WHERE id = ?`)
      .get(id) as any;

    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const turns = sqlite
      .prepare(`SELECT * FROM interview_turns WHERE session_id = ? ORDER BY seq ASC`)
      .all(id);

    const events = sqlite
      .prepare(`SELECT * FROM interview_events WHERE session_id = ? ORDER BY t_offset_ms ASC`)
      .all(id);

    const snapshots = sqlite
      .prepare(`SELECT * FROM interview_snapshots WHERE session_id = ? ORDER BY t_offset_ms ASC`)
      .all(id);

    const scores = sqlite
      .prepare(`SELECT * FROM interview_scores WHERE session_id = ?`)
      .all(id);

    const usage = sqlite
      .prepare(`SELECT * FROM interview_usage WHERE session_id = ?`)
      .get(id);

    return NextResponse.json({
      success: true,
      session,
      turns,
      events,
      snapshots,
      scores,
      usage,
    });
  } catch (err: any) {
    console.error(`Error fetching interview session ${params?.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load session details' },
      { status: 500 }
    );
  }
}
