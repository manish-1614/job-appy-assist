import { NextResponse } from 'next/server';
import { sqlite } from '@/lib/db';

export async function GET() {
  try {
    const sessions = sqlite
      .prepare(
        `SELECT s.*, 
                u.input_audio_tokens, u.output_audio_tokens, u.text_in, u.text_out,
                (SELECT COUNT(*) FROM interview_turns WHERE session_id = s.id) as turn_count,
                (SELECT COUNT(*) FROM interview_snapshots WHERE session_id = s.id) as snapshot_count
         FROM interview_sessions s
         LEFT JOIN interview_usage u ON s.id = u.session_id
         ORDER BY s.started_at DESC
         LIMIT 50`
      )
      .all();

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (err: any) {
    console.error('Error fetching interview sessions:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load sessions' },
      { status: 500 }
    );
  }
}
