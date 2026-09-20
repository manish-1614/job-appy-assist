/**
 * Background Automation Runner & Scheduler for Job Discovery Portal
 * 
 * Schedule: 9:00 AM & 9:00 PM IST (03:30 & 15:30 UTC)
 * Usage:
 *   node ./node_modules/tsx/dist/cli.mjs scripts/scheduler.ts --once   (Run immediate one-off scan)
 *   node ./node_modules/tsx/dist/cli.mjs scripts/scheduler.ts          (Start persistent background worker)
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Direct imports for runner
import {
  fetchCompanyJobs,
  fetchRssJobs,
  RawJobPosting,
  EvaluatedJob,
  formatPostedAgo,
} from '../lib/ats-adapters';
import {
  loadCompanies,
  loadCanonicalJobs,
  loadCandidateProfile,
  saveScanResult,
  updateManualScanTimestamp,
} from '../lib/storage';
import { passesDeterministicGate, evaluateWithHeuristics, evaluateJobWithLLM } from '../lib/ai-evaluator';
import { reconcileSourceScan, SourceScanResult, ScanObservation } from '../lib/lifecycle';
import { sendTelegramDigest } from '../lib/telegram';
import { canonicalizeUrl } from '../lib/dedup';

const LOCK_FILE = path.join(process.cwd(), 'data', 'scanner.lock');

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(): boolean {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(LOCK_FILE)) {
    try {
      const content = fs.readFileSync(LOCK_FILE, 'utf8');
      const lockData = JSON.parse(content);
      if (lockData.pid && isProcessAlive(lockData.pid)) {
        console.warn(`[Lock Guard] Scan already running (PID: ${lockData.pid}, started: ${lockData.startedAt}). Exiting.`);
        return false;
      }
    } catch {
      // Corrupt lock file, overwrite
    }
  }

  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
    'utf8'
  );
  return true;
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (err) {
    console.error('[Lock Guard] Error releasing lock:', err);
  }
}

// Cleanup lock on unexpected exit
process.on('exit', releaseLock);
process.on('SIGINT', () => { releaseLock(); process.exit(0); });
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });

export async function executeScanJob(): Promise<void> {
  if (!acquireLock()) {
    return;
  }

  const runStartTime = new Date();
  const scanTimestampStr = runStartTime.toISOString();
  const scanIdStr = `scan_${scanTimestampStr.replace(/[:.]/g, '-')}`;

  console.log(`\n[${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST] Starting Scheduled Job Discovery Cycle: ${scanIdStr}`);

  try {
    const profile = loadCandidateProfile();
    const companies = loadCompanies();
    const activeCompanies = companies.filter(c => c.isActive);

    console.log(`📡 Ingesting from ${activeCompanies.length} active sources...`);

    let totalRawFetched = 0;
    let healthySourcesCount = 0;
    const allQualifyingJobs: EvaluatedJob[] = [];

    for (const company of activeCompanies) {
      const sourceId = `${company.ats}:${company.slug}`;
      console.log(`Checking [${company.ats.toUpperCase()}] ${company.name}...`);

      let rawPostings: RawJobPosting[] = [];
      let isSuccess = true;
      let httpStatus = 200;

      try {
        if (company.ats === 'rss') {
          rawPostings = await fetchRssJobs(company.slug, company.name);
        } else {
          rawPostings = await fetchCompanyJobs(company.name, company.ats, company.slug);
        }
        totalRawFetched += rawPostings.length;
        healthySourcesCount++;
      } catch (err: any) {
        isSuccess = false;
        httpStatus = 500;
        console.error(`❌ Failed fetching ${company.name}:`, err.message);
      }

      // Filter and evaluate observed postings
      const observations: ScanObservation[] = [];

      for (const raw of rawPostings) {
        // Gate check (F2)
        if (!passesDeterministicGate(raw)) {
          continue;
        }

        const evalResult = evaluateWithHeuristics(raw, profile);

        observations.push({
          ats: company.ats,
          slug: company.slug,
          externalId: raw.externalId,
          title: raw.title,
          company: raw.company,
          location: raw.location,
          canonicalUrl: canonicalizeUrl(raw.applyUrl),
          applyUrl: raw.applyUrl,
          sourceType: raw.channelType || 'ats',
          score: evalResult.score,
          matchReason: evalResult.matchReason,
          strengths: evalResult.strengths,
          concerns: evalResult.concerns,
          techStack: evalResult.techStack,
          sponsorship: evalResult.sponsorship,
          isRemote: evalResult.isRemote,
          salary: evalResult.salary,
          firstPublishedAt: raw.postedAt || raw.updatedAt,
          contentHtml: raw.contentHtml,
          rawJson: JSON.stringify(raw),
        });

        // Track qualifying jobs (score >= 70)
        if (evalResult.score >= 70) {
          allQualifyingJobs.push({
            id: `${company.ats}:${company.slug}:${raw.externalId}`,
            title: raw.title,
            company: raw.company,
            location: raw.location,
            score: evalResult.score,
            salary: evalResult.salary,
            sponsorship: evalResult.sponsorship,
            isRemote: evalResult.isRemote,
            matchReason: evalResult.matchReason,
            evidence: evalResult.strengths,
            techStack: evalResult.techStack,
            postedAgo: formatPostedAgo(raw.postedAt, scanTimestampStr),
            source: raw.channelType || 'ats',
            canonicalUrl: canonicalizeUrl(raw.applyUrl),
            status: 'open',
            firstSeenAt: scanTimestampStr,
            lastSeenAt: scanTimestampStr,
            isNewInCurrentScan: true,
          });
        }
      }

      // Reconcile lifecycle in SQLite (2-scan closure, reopen, JD persistence)
      const sourceResult: SourceScanResult = {
        sourceId,
        ats: company.ats,
        slug: company.slug,
        name: company.name,
        httpStatus,
        isSuccess,
        observedJobs: observations,
      };

      const reconSummary = reconcileSourceScan(sourceResult, scanTimestampStr);
      console.log(
        `  -> ${company.name}: ${observations.length} passed gate (${reconSummary.newJobsCount} new, ${reconSummary.closedJobsCount} closed, ${reconSummary.reopenedJobsCount} reopened)`
      );
    }

    console.log(`📥 Total raw postings retrieved: ${totalRawFetched}`);
    console.log(`🎯 Fresh qualifying roles identified: ${allQualifyingJobs.length}`);

    // Sort by score descending
    allQualifyingJobs.sort((a, b) => b.score - a.score);

    // Optional LLM deep assessment for top roles using REAL JD content (F3)
    const hasLlmKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.USE_OLLAMA === 'true');
    if (hasLlmKey && allQualifyingJobs.length > 0) {
      console.log(`🧠 Running deep LLM assessment on top ${Math.min(5, allQualifyingJobs.length)} roles...`);
      const topRolesToDeepEval = allQualifyingJobs.slice(0, 5);

      await Promise.all(topRolesToDeepEval.map(async (job) => {
        try {
          const rawEquiv: RawJobPosting = {
            externalId: job.id,
            company: job.company,
            title: job.title,
            location: job.location,
            applyUrl: job.canonicalUrl,
            contentHtml: job.matchReason, // Will be replaced with real JD in Phase 2
            source: job.source,
          };
          const deepRes = await evaluateJobWithLLM(rawEquiv, profile);
          job.score = deepRes.score;
          job.matchReason = deepRes.matchReason;
          if (deepRes.strengths.length > 0) {
            job.evidence = [...deepRes.strengths, ...deepRes.evidenceQuotes];
          }
        } catch {
          // Keep heuristic evaluation on error
        }
      }));
    }

    // Dispatch Telegram Report with accurate sourcesChecked (F18)
    const totalSourcesChecked = activeCompanies.length;
    console.log(`📨 Dispatching Telegram notification digest (${totalSourcesChecked} sources checked)...`);
    const telegramResult = await sendTelegramDigest({
      scanId: scanIdStr,
      timestamp: scanTimestampStr,
      freshJobs: allQualifyingJobs.slice(0, 10),
      totalSourcesChecked,
      healthySourcesCount: healthySourcesCount || totalSourcesChecked,
    });
    console.log(`✅ Telegram digest dispatched (${telegramResult.isMock ? 'Mock' : 'Live'}).`);

    // Persist scan result record and sync JSON stores
    await saveScanResult({
      timestamp: scanTimestampStr,
      totalRawJobsFetched: totalRawFetched,
      sourcesChecked: totalSourcesChecked,
      healthySourcesCount,
      jobs: allQualifyingJobs,
    });

    console.log(`💾 Persisted scan results and updated SQLite datastore successfully.`);
  } catch (error: any) {
    console.error(`❌ Scan execution failed:`, error);
  } finally {
    releaseLock();
  }
}

// Command-line entry point
const isOnce = process.argv.includes('--once');

if (isOnce) {
  console.log('⚡ Running single on-demand scan...');
  executeScanJob().then(() => {
    console.log('🏁 One-off scan complete.');
    process.exit(0);
  });
} else {
  console.log('🤖 Job Discovery Daemon Initialized.');
  console.log('🕒 Target Schedule: 9:00 AM & 9:00 PM IST (3:30 & 15:30 UTC daily).');

  const getNextRunDelay = (): number => {
    const now = new Date();
    const istTime = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);

    const morningTarget = new Date(istTime);
    morningTarget.setHours(9, 0, 0, 0);

    const eveningTarget = new Date(istTime);
    eveningTarget.setHours(21, 0, 0, 0);

    let nextTarget = morningTarget;
    if (istTime.getTime() > eveningTarget.getTime()) {
      nextTarget = new Date(morningTarget.getTime() + 24 * 60 * 60 * 1000);
    } else if (istTime.getTime() > morningTarget.getTime()) {
      nextTarget = eveningTarget;
    }

    const delayMs = nextTarget.getTime() - istTime.getTime();
    console.log(`⏳ Next automated cycle scheduled in: ${(delayMs / (1000 * 60)).toFixed(1)} minutes (at ${nextTarget.toLocaleTimeString()} IST).`);
    return delayMs;
  };

  const scheduleNext = () => {
    const delay = getNextRunDelay();
    setTimeout(async () => {
      await executeScanJob();
      scheduleNext();
    }, delay);
  };

  scheduleNext();
}
