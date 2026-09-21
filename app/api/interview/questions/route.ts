import { NextResponse } from 'next/server';
import { loadAllQuestions } from '@/lib/interview/prompts';
import { checkBudgetGuard } from '@/lib/interview/cost-meter';

export async function GET() {
  try {
    const questions = loadAllQuestions();
    const budget = checkBudgetGuard();

    return NextResponse.json({
      success: true,
      questions,
      budget,
    });
  } catch (err: any) {
    console.error('Error fetching interview questions:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to load questions' },
      { status: 500 }
    );
  }
}
