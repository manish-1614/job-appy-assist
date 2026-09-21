import { NextRequest, NextResponse } from 'next/server';
import { InterviewGraderEngine } from '@/lib/interview/grader';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const grader = new InterviewGraderEngine();
    const result = await grader.gradeSession({ sessionId: id });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error(`Error grading session ${params?.id}:`, err);
    return NextResponse.json(
      { success: false, error: err.message || 'Grading failed' },
      { status: 500 }
    );
  }
}
