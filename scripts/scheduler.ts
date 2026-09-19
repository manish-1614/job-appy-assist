/**
 * Background Automation Runner & Scheduler for Job Discovery Portal
 * 
 * Schedule: 9:00 AM & 9:00 PM IST (03:30 & 15:30 UTC)
 * Usage:
 *   node scripts/scheduler.ts --once   (Run immediate one-off scan)
 *   node scripts/scheduler.ts          (Start persistent background worker)
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// Direct imports for runner
import { fetchCompanyJobs, fetchRssJobs, evaluateRawJob, EvaluatedJob, RawJobPosting } from '../lib/ats-adapters';
import { 
  loadCompanies, 
  loadCanonicalJobs, 
  loadCandidateProfile, 
  saveScanResult,
  updateManualScanTimestamp 
} from '../lib/storage';
import { sendTelegramDigest } from '../lib/telegram';
import { evaluateJobWithLLM } from '../lib/ai-evaluator';

async function executeScanJob(): Promise<void> {
  const runStartTime = new Date();
  const scanTimestampStr = runStartTime.toISOString();
  const scanIdStr = `scan_${scanTimestampStr.replace(/[:.]/g, '-')}`;

  console.log(`\n[${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST] Starting Scheduled Job Discovery Cycle: ${scanIdStr}`);

  try {
    const existingJobsPool: EvaluatedJob[] = loadCanonicalJobs();
    const profile = loadCandidateProfile();
    const companies = loadCompanies();
    const activeCompanies = companies.filter(c => c.isActive);

    console.log(`📡 Ingesting from ${activeCompanies.length} active sources...`);

    let healthySourcesCount = 0;
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
      } catch (err: any) {
        console.error(`❌ Error fetching ${company.name}:`, err.message);
        return [];
      }
    });

    const allRawResults = await Promise.all(fetchPromises);
    const totalRawFetched = allRawResults.reduce((sum, list) => sum + list.length, 0);
    console.log(`📥 Total raw postings retrieved: ${totalRawFetched}`);

    const allEvaluatedJobs: EvaluatedJob[] = [];
    allRawResults.forEach(rawList => {
      rawList.forEach(rawItem => {
        const evaluated = evaluateRawJob(rawItem, existingJobsPool, scanTimestampStr);
        if (evaluated) {
          allEvaluatedJobs.push(evaluated);
        }
      });
    });

    allEvaluatedJobs.sort((a, b) => b.score - a.score);

    // Identify Fresh Qualifying Jobs (score >= 70, status == 'open', new in this scan)
    const freshQualifyingJobs = allEvaluatedJobs.filter(
      j => j.score >= 70 && j.status === 'open' && j.isNewInCurrentScan
    );

    console.log(`🎯 Fresh qualifying roles identified: ${freshQualifyingJobs.length}`);

    // Optional LLM deep evaluation for top qualifying roles
    const hasLlmKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.USE_OLLAMA === 'true');
    if (hasLlmKey && freshQualifyingJobs.length > 0) {
      console.log(`🧠 Running deep LLM assessment on top ${Math.min(5, freshQualifyingJobs.length)} roles...`);
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
          // ignore error
        }
      }));
    }

    // Dispatch Telegram Report
    const totalSourcesChecked = activeCompanies.length;
    console.log(`📨 Dispatching Telegram notification digest...`);
    const telegramResult = await sendTelegramDigest({
      scanId: scanIdStr,
      timestamp: scanTimestampStr,
      freshJobs: freshQualifyingJobs,
      totalSourcesChecked,
      healthySourcesCount: healthySourcesCount || totalSourcesChecked,
    });
    console.log(`✅ Telegram digest dispatched (${telegramResult.isMock ? 'Mock' : 'Live'}).`);

    // Persist to data/jobs.json, data/runs.json, and data/scans/
    await saveScanResult({
      timestamp: scanTimestampStr,
      totalRawJobsFetched: totalRawFetched,
      jobs: allEvaluatedJobs,
    });
    updateManualScanTimestamp(scanTimestampStr);

    console.log(`💾 Persisted to data/jobs.json & data/runs.json successfully.`);
  } catch (error: any) {
    console.error(`❌ Scan execution failed:`, error);
  }
}

// Check if run-once flag is provided
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
  
  // Calculate next run time
  const getNextRunDelay = (): number => {
    const now = new Date();
    // Convert to IST offset (+5.5 hours = 330 mins)
    const istTime = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
    
    const morningTarget = new Date(istTime);
    morningTarget.setHours(9, 0, 0, 0);

    const eveningTarget = new Date(istTime);
    eveningTarget.setHours(21, 0, 0, 0);

    let nextTarget = morningTarget;
    if (istTime.getTime() > eveningTarget.getTime()) {
      // Next is tomorrow 9 AM
      nextTarget = new Date(morningTarget.getTime() + 24 * 60 * 60 * 1000);
    } else if (istTime.getTime() > morningTarget.getTime()) {
      // Next is today 9 PM
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
