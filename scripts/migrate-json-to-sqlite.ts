import fs from 'fs';
import path from 'path';
import { sqlite } from '../lib/db';
import { cleanHtmlToText, computeContentHash } from '../lib/jd-cleaner';
import { canonicalizeUrl, createJobIdentity } from '../lib/dedup';

interface CompanyConfig {
  id: string;
  name: string;
  ats: string;
  slug: string;
  careersUrl?: string;
  priority?: number;
  isActive?: boolean;
}

interface RunLog {
  id: string;
  timestamp: string;
  totalRawJobsFetched?: number;
  qualifyingJobsCount?: number;
  sourcesChecked?: number;
  status: string;
}

function parseJobCoordinates(job: any, companyAtsMap: Map<string, { ats: string; slug: string }>): {
  ats: string;
  slug: string;
  externalId: string;
} {
  const url = job.canonicalUrl || job.applyUrl || '';
  const companyKey = (job.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let ats = (job.source || '').toLowerCase();
  let slug = '';
  let externalId = '';

  // 1. Try resolving slug and ats from company mapping
  for (const [key, mapping] of companyAtsMap.entries()) {
    if (companyKey.includes(key) || key.includes(companyKey)) {
      ats = mapping.ats;
      slug = mapping.slug;
      break;
    }
  }

  // 2. Fallbacks based on URL structure
  if (!ats || ats === 'ats') {
    if (url.includes('greenhouse.io') || url.includes('stripe.com')) ats = 'greenhouse';
    else if (url.includes('lever.co')) ats = 'lever';
    else if (url.includes('ashbyhq.com') || url.includes('ramp.com') || url.includes('linear.app')) ats = 'ashby';
    else if (url.includes('smartrecruiters.com')) ats = 'smartrecruiters';
    else if (url.includes('weworkremotely.com')) ats = 'rss';
    else ats = 'web';
  }

  // 3. Fallbacks based on ID string
  const idStr = String(job.id || '');
  if (idStr.startsWith('live-')) {
    const parts = idStr.replace(/^live-/, '').split('-');
    if (parts.length >= 2) {
      if (!slug) slug = parts[0];
      externalId = parts.slice(1).join('-');
    }
  }

  // 4. Try extracting externalId from URL if still empty
  if (!externalId) {
    try {
      const parsed = new URL(url);
      const ghJid = parsed.searchParams.get('gh_jid');
      if (ghJid) {
        externalId = ghJid;
      } else {
        const segments = parsed.pathname.split('/').filter(Boolean);
        externalId = segments[segments.length - 1] || idStr;
      }
    } catch {
      externalId = idStr;
    }
  }

  if (!slug) {
    slug = companyKey || 'unknown';
  }

  return {
    ats: ats || 'ats',
    slug: slug || 'unknown',
    externalId: externalId || idStr || String(Math.random()),
  };
}

export function runMigration() {
  console.log('--- Starting Idempotent JSON -> SQLite Migration ---');

  const dataDir = path.resolve(process.cwd(), 'data');
  const companiesPath = path.join(dataDir, 'companies.json');
  const jobsPath = path.join(dataDir, 'jobs.json');
  const runsPath = path.join(dataDir, 'runs.json');

  const companyAtsMap = new Map<string, { ats: string; slug: string }>();

  // 1. Migrate Sources
  if (fs.existsSync(companiesPath)) {
    const companies: CompanyConfig[] = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));
    console.log(`Migrating ${companies.length} tracked companies into sources table...`);

    const insertSource = sqlite.prepare(`
      INSERT OR REPLACE INTO sources (
        id, ats, slug, name, careers_url, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    sqlite.transaction(() => {
      for (const comp of companies) {
        const sourceId = `${comp.ats}:${comp.slug}`;
        insertSource.run(
          sourceId,
          comp.ats,
          comp.slug,
          comp.name,
          comp.careersUrl || null,
          comp.isActive !== false ? 1 : 0,
          new Date().toISOString()
        );

        const normName = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        companyAtsMap.set(normName, { ats: comp.ats, slug: comp.slug });
        companyAtsMap.set(comp.slug.toLowerCase(), { ats: comp.ats, slug: comp.slug });
      }
    })();
  }

  // 2. Migrate Runs
  if (fs.existsSync(runsPath)) {
    const runs: RunLog[] = JSON.parse(fs.readFileSync(runsPath, 'utf8'));
    console.log(`Migrating ${runs.length} historical run logs into runs table...`);

    const insertRun = sqlite.prepare(`
      INSERT OR REPLACE INTO runs (
        id, started_at, finished_at, sources_checked, healthy_sources_count,
        jobs_seen_count, new_jobs_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    sqlite.transaction(() => {
      for (const r of runs) {
        insertRun.run(
          r.id,
          r.timestamp,
          r.timestamp,
          r.sourcesChecked || 10,
          r.sourcesChecked || 10,
          r.totalRawJobsFetched || 0,
          r.qualifyingJobsCount || 0,
          r.status || 'completed'
        );
      }
    })();
  }

  // 3. Migrate Jobs & Backfill Schema Drift
  if (!fs.existsSync(jobsPath)) {
    console.error(`Error: jobs.json not found at ${jobsPath}`);
    return;
  }

  const jobsData: any[] = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
  console.log(`Total jobs loaded from JSON: ${jobsData.length}`);

  const insertJob = sqlite.prepare(`
    INSERT OR REPLACE INTO jobs (
      id, ats, slug, external_id, title, company, location, location_class,
      canonical_url, apply_url, source_type, score, match_reason,
      strengths_json, concerns_json, tech_stack_json, sponsorship,
      is_remote, salary, status, gate_reason, consecutive_missing_scans,
      first_seen_at, last_seen_at, first_published_at, raw_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const insertDescription = sqlite.prepare(`
    INSERT OR REPLACE INTO job_descriptions (
      job_id, content_hash, description_text, description_html, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const insertEvent = sqlite.prepare(`
    INSERT INTO job_events (
      job_id, event_type, created_at, payload_json
    ) VALUES (?, ?, ?, ?)
  `);

  let legacyBackfilledCount = 0;
  let descriptionsPersisted = 0;

  const baselineFirstSeen = '2026-07-28T18:50:28.805Z';
  const baselineLastSeen = '2026-09-13T06:26:46.701Z';

  sqlite.transaction(() => {
    for (const job of jobsData) {
      const coords = parseJobCoordinates(job, companyAtsMap);
      const compositeId = createJobIdentity(coords.ats, coords.slug, coords.externalId);

      // Backfill missing fields (F12)
      const isLegacy = !job.status;
      if (isLegacy) legacyBackfilledCount++;

      const status = job.status || 'open';
      const firstSeenAt = job.firstSeenAt || baselineFirstSeen;
      const lastSeenAt = job.lastSeenAt || baselineLastSeen;
      const canonicalUrl = canonicalizeUrl(job.canonicalUrl || job.applyUrl || '');
      const applyUrl = job.applyUrl || job.canonicalUrl || '';

      const strengths = Array.isArray(job.evidence) ? job.evidence : (job.strengths || []);
      const concerns = Array.isArray(job.concerns) ? job.concerns : [];
      const techStack = Array.isArray(job.techStack) ? job.techStack : [];

      insertJob.run(
        compositeId,
        coords.ats,
        coords.slug,
        coords.externalId,
        job.title || 'Untitled',
        job.company || 'Unknown',
        job.location || 'Unknown',
        'unknown', // Location class will be classified by Scorer v2 in Phase 2
        canonicalUrl,
        applyUrl,
        job.channelType || job.sourceType || 'ats',
        typeof job.score === 'number' ? job.score : 0,
        job.matchReason || null,
        JSON.stringify(strengths),
        JSON.stringify(concerns),
        JSON.stringify(techStack),
        job.sponsorship || 'unconfirmed',
        job.isRemote ? 1 : 0,
        job.salary || 'Salary not stated',
        status,
        null, // gate_reason
        0,    // consecutive_missing_scans
        firstSeenAt,
        lastSeenAt,
        job.postedAgo || null,
        JSON.stringify(job)
      );

      // Persist JD description if HTML or text content is available (F4)
      const jdContent = job.contentHtml || job.description || '';
      if (jdContent) {
        const cleanText = cleanHtmlToText(jdContent);
        const hash = computeContentHash(cleanText);
        insertDescription.run(
          compositeId,
          hash,
          cleanText,
          job.contentHtml || null,
          lastSeenAt
        );
        descriptionsPersisted++;
      }
    }
  })();

  // 4. Audit & Verification
  const totalJobsCount = (sqlite.prepare('SELECT COUNT(*) as count FROM jobs').get() as any).count;
  const nullStatusCount = (sqlite.prepare('SELECT COUNT(*) as count FROM jobs WHERE status IS NULL').get() as any).count;
  const nullFirstSeenCount = (sqlite.prepare('SELECT COUNT(*) as count FROM jobs WHERE first_seen_at IS NULL').get() as any).count;
  const nullLastSeenCount = (sqlite.prepare('SELECT COUNT(*) as count FROM jobs WHERE last_seen_at IS NULL').get() as any).count;
  const openJobsCount = (sqlite.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'open'").get() as any).count;
  const sourcesCount = (sqlite.prepare('SELECT COUNT(*) as count FROM sources').get() as any).count;

  console.log('\n--- Migration Audit Results ---');
  console.log(`Total jobs in SQLite: ${totalJobsCount}`);
  console.log(`Legacy rows backfilled: ${legacyBackfilledCount}`);
  console.log(`Open jobs count: ${openJobsCount}`);
  console.log(`Jobs with NULL status: ${nullStatusCount} (Target: 0)`);
  console.log(`Jobs with NULL firstSeenAt: ${nullFirstSeenCount} (Target: 0)`);
  console.log(`Jobs with NULL lastSeenAt: ${nullLastSeenCount} (Target: 0)`);
  console.log(`Total active sources in SQLite: ${sourcesCount}`);
  console.log(`Job descriptions persisted: ${descriptionsPersisted}`);

  if (totalJobsCount < 1975 || nullStatusCount > 0) {
    throw new Error(`Migration acceptance criteria failed: expected >= 1975 jobs and 0 null statuses, got ${totalJobsCount} jobs and ${nullStatusCount} null statuses.`);
  }

  console.log('✓ Migration verified and complete!');
}

if (require.main === module || process.argv[1]?.includes('migrate-json-to-sqlite')) {
  runMigration();
}
