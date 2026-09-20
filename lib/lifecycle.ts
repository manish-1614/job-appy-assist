import { sqlite } from './db';
import { cleanHtmlToText, computeContentHash } from './jd-cleaner';
import { canonicalizeUrl, createJobIdentity } from './dedup';

export interface ScanObservation {
  ats: string;
  slug: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  canonicalUrl: string;
  applyUrl: string;
  sourceType?: string;
  score?: number;
  matchReason?: string;
  strengths?: string[];
  concerns?: string[];
  techStack?: string[];
  sponsorship?: 'explicit' | 'possible' | 'unconfirmed';
  isRemote?: boolean;
  salary?: string;
  firstPublishedAt?: string;
  contentHtml?: string;
  rawJson?: string;
}

export interface SourceScanResult {
  sourceId: string;
  ats: string;
  slug: string;
  name: string;
  httpStatus: number;
  isSuccess: boolean;
  observedJobs: ScanObservation[];
  errorMessage?: string;
  bypassDegradedCheck?: boolean;
}

export interface LifecycleReconciliationSummary {
  seenCount: number;
  newJobsCount: number;
  updatedJobsCount: number;
  missingIncrementCount: number;
  closedJobsCount: number;
  reopenedJobsCount: number;
  skippedUnhealthySourcesCount: number;
}

/**
 * Reconciles scan observations against SQLite database enforcing the 2-scan closure lifecycle,
 * source-failure circuit breakers, and reopen events.
 */
export function reconcileSourceScan(
  result: SourceScanResult,
  timestamp: string = new Date().toISOString()
): LifecycleReconciliationSummary {
  const summary: LifecycleReconciliationSummary = {
    seenCount: result.observedJobs.length,
    newJobsCount: 0,
    updatedJobsCount: 0,
    missingIncrementCount: 0,
    closedJobsCount: 0,
    reopenedJobsCount: 0,
    skippedUnhealthySourcesCount: 0,
  };

  const sourceRow = sqlite
    .prepare('SELECT * FROM sources WHERE ats = ? AND slug = ?')
    .get(result.ats, result.slug) as any;

  // 1. Check Source Health (F5, F6)
  let isSourceHealthy = result.isSuccess && result.httpStatus === 200;
  const previousCount = sourceRow?.last_job_count || 0;
  const observedCount = result.observedJobs.length;

  if (isSourceHealthy && !result.bypassDegradedCheck) {
    // Drop of >50% on a previously non-empty source (>10 jobs) indicates endpoint error/rate limit
    if (previousCount > 10 && observedCount < previousCount * 0.5) {
      isSourceHealthy = false;
      console.warn(
        `[Lifecycle Guard] Source ${result.ats}:${result.slug} returned ${observedCount} jobs vs previous ${previousCount} (>50% drop). Treating as degraded source.`
      );
    } else if (previousCount > 0 && observedCount === 0) {
      isSourceHealthy = false;
      console.warn(
        `[Lifecycle Guard] Source ${result.ats}:${result.slug} returned 0 jobs vs previous ${previousCount}. Treating as degraded source.`
      );
    }
  }

  if (!isSourceHealthy) {
    summary.skippedUnhealthySourcesCount++;
    sqlite
      .prepare(
        'UPDATE sources SET last_error_at = ?, last_http_status = ? WHERE ats = ? AND slug = ?'
      )
      .run(timestamp, result.httpStatus || 500, result.ats, result.slug);
    return summary; // Do not update sightings or close jobs when source is degraded
  }

  // Record healthy source status
  sqlite
    .prepare(
      'UPDATE sources SET last_success_at = ?, last_http_status = 200, last_job_count = ? WHERE ats = ? AND slug = ?'
    )
    .run(timestamp, observedCount, result.ats, result.slug);

  const observedExternalIds = new Set<string>();

  const insertOrUpdateJob = sqlite.prepare(`
    INSERT INTO jobs (
      id, ats, slug, external_id, title, company, location, location_class,
      canonical_url, apply_url, source_type, score, match_reason,
      strengths_json, concerns_json, tech_stack_json, sponsorship,
      is_remote, salary, status, consecutive_missing_scans,
      first_seen_at, last_seen_at, first_published_at, raw_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, 'open', 0,
      ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      canonical_url = excluded.canonical_url,
      apply_url = excluded.apply_url,
      score = excluded.score,
      match_reason = excluded.match_reason,
      strengths_json = excluded.strengths_json,
      concerns_json = excluded.concerns_json,
      tech_stack_json = excluded.tech_stack_json,
      sponsorship = excluded.sponsorship,
      is_remote = excluded.is_remote,
      salary = excluded.salary,
      consecutive_missing_scans = 0,
      last_seen_at = excluded.last_seen_at,
      raw_json = excluded.raw_json
  `);

  const insertDescription = sqlite.prepare(`
    INSERT INTO job_descriptions (
      job_id, content_hash, description_text, description_html, updated_at
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      content_hash = excluded.content_hash,
      description_text = excluded.description_text,
      description_html = excluded.description_html,
      updated_at = excluded.updated_at
  `);

  const insertEvent = sqlite.prepare(`
    INSERT INTO job_events (job_id, event_type, created_at, payload_json)
    VALUES (?, ?, ?, ?)
  `);

  sqlite.transaction(() => {
    // 2. Process all sightings (Observed jobs)
    for (const obs of result.observedJobs) {
      observedExternalIds.add(obs.externalId);
      const compositeId = createJobIdentity(obs.ats, obs.slug, obs.externalId);
      const canonical = canonicalizeUrl(obs.canonicalUrl || obs.applyUrl);

      const existingJob = sqlite
        .prepare('SELECT id, status, consecutive_missing_scans FROM jobs WHERE id = ?')
        .get(compositeId) as { id: string; status: string; consecutive_missing_scans: number } | undefined;

      if (!existingJob) {
        // Discovered brand new job
        insertOrUpdateJob.run(
          compositeId,
          obs.ats,
          obs.slug,
          obs.externalId,
          obs.title,
          obs.company,
          obs.location,
          'unknown',
          canonical,
          obs.applyUrl,
          obs.sourceType || 'ats',
          obs.score || 0,
          obs.matchReason || null,
          JSON.stringify(obs.strengths || []),
          JSON.stringify(obs.concerns || []),
          JSON.stringify(obs.techStack || []),
          obs.sponsorship || 'unconfirmed',
          obs.isRemote ? 1 : 0,
          obs.salary || 'Salary not stated',
          timestamp, // firstSeenAt
          timestamp, // lastSeenAt
          obs.firstPublishedAt || null,
          obs.rawJson || null
        );

        insertEvent.run(compositeId, 'discovered', timestamp, JSON.stringify({ title: obs.title }));
        summary.newJobsCount++;
      } else {
        // Existing job sighted again (F5: update lastSeenAt and reset consecutive_missing_scans)
        if (existingJob.status === 'closed') {
          // Job reopened! (F6)
          sqlite
            .prepare("UPDATE jobs SET status = 'open', consecutive_missing_scans = 0 WHERE id = ?")
            .run(compositeId);
          insertEvent.run(compositeId, 'reopened', timestamp, JSON.stringify({ previousStatus: 'closed' }));
          summary.reopenedJobsCount++;
        }

        insertOrUpdateJob.run(
          compositeId,
          obs.ats,
          obs.slug,
          obs.externalId,
          obs.title,
          obs.company,
          obs.location,
          'unknown',
          canonical,
          obs.applyUrl,
          obs.sourceType || 'ats',
          obs.score || 0,
          obs.matchReason || null,
          JSON.stringify(obs.strengths || []),
          JSON.stringify(obs.concerns || []),
          JSON.stringify(obs.techStack || []),
          obs.sponsorship || 'unconfirmed',
          obs.isRemote ? 1 : 0,
          obs.salary || 'Salary not stated',
          timestamp,
          timestamp,
          obs.firstPublishedAt || null,
          obs.rawJson || null
        );

        summary.updatedJobsCount++;
      }

      // Persist JD text if available (F4)
      if (obs.contentHtml) {
        const cleanText = cleanHtmlToText(obs.contentHtml);
        const hash = computeContentHash(cleanText);
        insertDescription.run(compositeId, hash, cleanText, obs.contentHtml, timestamp);
      }
    }

    // 3. Process missing jobs for this source (2-Scan Closure Lifecycle)
    // Only query open jobs for this specific ats + slug
    const openJobsInDb = sqlite
      .prepare("SELECT id, external_id, consecutive_missing_scans FROM jobs WHERE ats = ? AND slug = ? AND status = 'open'")
      .all(result.ats, result.slug) as { id: string; external_id: string; consecutive_missing_scans: number }[];

    for (const openJob of openJobsInDb) {
      if (!observedExternalIds.has(openJob.external_id)) {
        const newMissingCount = (openJob.consecutive_missing_scans || 0) + 1;

        if (newMissingCount >= 2) {
          // Closed after 2 consecutive scans without sighting (F6)
          sqlite
            .prepare("UPDATE jobs SET status = 'closed', consecutive_missing_scans = ? WHERE id = ?")
            .run(newMissingCount, openJob.id);
          insertEvent.run(openJob.id, 'closed', timestamp, JSON.stringify({ consecutiveMissingScans: newMissingCount }));
          summary.closedJobsCount++;
        } else {
          // Grace period: first missing scan
          sqlite
            .prepare('UPDATE jobs SET consecutive_missing_scans = ? WHERE id = ?')
            .run(newMissingCount, openJob.id);
          insertEvent.run(openJob.id, 'missing_scan', timestamp, JSON.stringify({ consecutiveMissingScans: newMissingCount }));
          summary.missingIncrementCount++;
        }
      }
    }
  })();

  return summary;
}
