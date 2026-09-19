import { NextRequest, NextResponse } from 'next/server';
import { evaluateTargetJobUrl } from '@/lib/url-evaluator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, saveToJobs } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'A valid URL is required.' },
        { status: 400 }
      );
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('URL must use http or https protocol');
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format. Please provide a full URL including https://' },
        { status: 400 }
      );
    }

    const result = await evaluateTargetJobUrl(parsedUrl.toString(), Boolean(saveToJobs));

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to analyze target job posting.' },
        { status: 422 }
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error in /api/eval/url:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error while evaluating URL' },
      { status: 500 }
    );
  }
}
