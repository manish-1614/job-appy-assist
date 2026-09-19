import { NextResponse } from 'next/server';
import { evaluateRawJob, RawJobPosting } from '@/lib/ats-adapters';
import { saveScanResult } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      title,
      company,
      location,
      applyUrl,
      contentHtml,
      channelName,
    } = body;

    if (!title || !company || !applyUrl) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: title, company, applyUrl are required.',
      }, { status: 400 });
    }

    const rawJob: RawJobPosting = {
      externalId: `broadcast-${Date.now()}`,
      company,
      title,
      location: location || 'Remote / Unstated',
      applyUrl,
      contentHtml: contentHtml || '',
      postedAt: new Date().toISOString(),
      source: `Broadcast Channel (${channelName || 'Telegram/Discord Webhook'})`,
      channelType: 'broadcast',
    };

    const evaluated = evaluateRawJob(rawJob);
    if (!evaluated) {
      return NextResponse.json({
        success: false,
        message: 'Job received but filtered out due to seniority/exclusion rules (e.g. Junior/Intern).',
      });
    }

    // Save as scan dataset
    const savedRecord = await saveScanResult({
      timestamp: new Date().toISOString(),
      totalRawJobsFetched: 1,
      jobs: [evaluated],
    });

    return NextResponse.json({
      success: true,
      scanId: savedRecord.id,
      message: 'Broadcast job successfully ingested and evaluated!',
      job: evaluated,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to ingest broadcast message',
    }, { status: 500 });
  }
}
