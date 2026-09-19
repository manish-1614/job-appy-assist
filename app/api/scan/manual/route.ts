import { NextResponse } from 'next/server';
import { 
  fetchCompanyJobs, 
  fetchRssJobs, 
  evaluateRawJob, 
  EvaluatedJob,
  RawJobPosting
} from '@/lib/ats-adapters';
import { 
  saveScanResult, 
  checkManualScanRateLimit, 
  loadCanonicalJobs,
  loadCompanies,
  loadCandidateProfile,
  CompanyConfig
} from '@/lib/storage';
import { evaluateJobWithLLM } from '@/lib/ai-evaluator';
import { sendTelegramDigest } from '@/lib/telegram';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET check rate limit status
export async function GET() {
  const rateLimit = checkManualScanRateLimit();
  return NextResponse.json({
    allowed: rateLimit.allowed,
    remainingSeconds: rateLimit.remainingSeconds,
    lastScanTimestamp: rateLimit.lastScanTimestamp,
  });
}

// POST trigger manual scan
export async function POST() {
  try {
    // 1. Enforce 5-minute (300 seconds) rate limit
    const rateLimit = checkManualScanRateLimit();
    if (!rateLimit.allowed) {
      return NextResponse.json({
        success: false,
        error: `Manual scan rate limit active. Please wait ${Math.ceil(rateLimit.remainingSeconds / 60)} more minute(s).`,
        remainingSeconds: rateLimit.remainingSeconds,
      }, { status: 429 });
    }

    const runStartTime = new Date();
    const scanTimestampStr = runStartTime.toISOString();
    const scanIdStr = `scan_${scanTimestampStr.replace(/[:.]/g, '-')}`;

    // 2. Load historical jobs pool from canonical jobs.json for cross-scan deduplication
    const existingJobsPool: EvaluatedJob[] = loadCanonicalJobs();
    const profile = loadCandidateProfile();

    // 3. Load active companies from dynamic watchlist (data/companies.json)
    const allCompanies: CompanyConfig[] = loadCompanies();
    const activeCompanies = allCompanies.filter(c => c.isActive);

    const allEvaluatedJobs: EvaluatedJob[] = [];
    let healthySourcesCount = 0;

    // 4. Concurrently fetch all active sources
    const fetchPromises = activeCompanies.map(async (company) => {
      try {
        let rawJobs: RawJobPosting[] = [];
        if (company.ats === 'rss') {
          rawJobs = await fetchRssJobs(company.slug, company.name);
        } else {
          rawJobs = await fetchCompanyJobs(company.name, company.ats, company.slug);
        }
        if (rawJobs.length > 0) healthySourcesCount++;
        return rawJobs;
      } catch (err) {
        console.error(`Error fetching from ${company.name}:`, err);
        return [];
      }
    });

    const allRawResults = await Promise.all(fetchPromises);
    const totalRawFetched = allRawResults.reduce((sum, list) => sum + list.length, 0);

    // 5. Run Two-Stage evaluation and deduplication
    allRawResults.forEach(rawList => {
      rawList.forEach(rawItem => {
        const evaluated = evaluateRawJob(rawItem, existingJobsPool, scanTimestampStr);
        if (evaluated) {
          allEvaluatedJobs.push(evaluated);
        }
      });
    });

    // Sort by Match Score descending
    allEvaluatedJobs.sort((a, b) => b.score - a.score);

    // 6. Identify Fresh Qualifying Jobs (score >= 70, status == 'open', firstSeenAt in this scan)
    const freshQualifyingJobs = allEvaluatedJobs.filter(
      j => j.score >= 70 && j.status === 'open' && j.isNewInCurrentScan
    );

    // Optional: Enhance top 5 fresh qualifying jobs with Stage-2 LLM evaluation if available
    const hasLlmKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.USE_OLLAMA === 'true');
    if (hasLlmKey && freshQualifyingJobs.length > 0) {
      const topRolesToDeepEval = freshQualifyingJobs.slice(0, 5);
      await Promise.all(topRolesToDeepEval.map(async (job) => {
        try {
          const rawEquiv: RawJobPosting = {
            externalId: job.id,
            company: job.company,
            title: job.title,
            location: job.location,
            applyUrl: job.canonicalUrl,
            contentHtml: job.matchReason,
            source: job.source,
          };
          const deepRes = await evaluateJobWithLLM(rawEquiv, profile);
          job.score = deepRes.score;
          job.matchReason = deepRes.matchReason;
          if (deepRes.strengths.length > 0) {
            job.evidence = [...deepRes.strengths, ...deepRes.evidenceQuotes];
          }
        } catch (e) {
          // Keep heuristic evaluation on deep eval error
        }
      }));
    }

    // 7. Dispatch Telegram Notification Digest
    const totalSourcesChecked = activeCompanies.length;
    const telegramResult = await sendTelegramDigest({
      scanId: scanIdStr,
      timestamp: scanTimestampStr,
      freshJobs: freshQualifyingJobs,
      totalSourcesChecked,
      healthySourcesCount: healthySourcesCount || totalSourcesChecked,
    });

    // 8. Save scan results to canonical jobs.json, runs.json, and data/scans/
    const savedRecord = await saveScanResult({
      timestamp: scanTimestampStr,
      totalRawJobsFetched: totalRawFetched,
      jobs: allEvaluatedJobs,
    });

    return NextResponse.json({
      success: true,
      scanId: savedRecord.id,
      scannedAt: scanTimestampStr,
      totalRawJobsFetched: totalRawFetched,
      qualifyingJobsCount: freshQualifyingJobs.length,
      possibleDuplicatesCount: allEvaluatedJobs.filter(j => j.status === 'possible_duplicate').length,
      telegramNotification: telegramResult,
      remainingSeconds: 300,
      jobs: allEvaluatedJobs,
    });
  } catch (error: any) {
    console.error('Scan error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete live scan',
    }, { status: 500 });
  }
}
