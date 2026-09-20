import fs from 'fs';
import path from 'path';
import { EvaluatedJob, AtsType, formatPostedAgo } from './ats-adapters';
import { sqlite } from './db';
import { cleanHtmlToText, computeContentHash } from './jd-cleaner';
import { canonicalizeUrl, createJobIdentity } from './dedup';

export type SkillItem = string | { name: string; verified: boolean };

export interface CandidateProfile {
  version: string;
  updatedAt: string;
  candidate: {
    name: string;
    email: string;
    phone: string;
    portfolioUrl: string;
    githubUrl: string;
    linkedinUrl: string;
    yearsOfExperience: number;
    currentCompany: string;
    currentTitle: string;
    education: string;
    headline: string;
  };
  targetRoles: string[];
  coreSkills: {
    languages: SkillItem[];
    backendAndDistributed: SkillItem[];
    aiAndWorkflowAutomation: SkillItem[];
    cloudAndDevOps: SkillItem[];
    databases: SkillItem[];
  };
  highlightedProjects: Array<{
    name: string;
    summary: string;
  }>;
  preferences: {
    workMode: string[];
    relocationTargetCountries: string[];
    relocationRequirement: string;
    minimumSalaryInrLakhs: number;
    targetSalaryInrLakhs: string;
  };
  dealbreakers: string[];
}

export interface CompanyConfig {
  id: string;
  name: string;
  ats: AtsType;
  slug: string;
  careersUrl: string;
  priority: number;
  isActive: boolean;
}

export interface RunHistoryRecord {
  id: string;
  timestamp: string;
  totalRawJobsFetched: number;
  qualifyingJobsCount: number;
  sourcesChecked: number;
  status: 'completed' | 'partial_failure' | 'failed';
  telegramStatus?: string;
}

export interface ScanRunData {
  id: string;
  timestamp: string;
  totalRawJobsFetched: number;
  qualifyingJobsCount: number;
  jobs: EvaluatedJob[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const SCANS_DIR = path.join(DATA_DIR, 'scans');
const RATE_LIMIT_FILE = path.join(SCANS_DIR, 'rate_limit.json');
const JOBS_FILE = path.join(DATA_DIR, 'jobs.json');
const COMPANIES_FILE = path.join(DATA_DIR, 'companies.json');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');
const PROFILE_FILE = path.join(DATA_DIR, 'profile.json');

export const MANUAL_SCAN_COOLDOWN_SECONDS = 300; // 5 minutes

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SCANS_DIR)) {
    fs.mkdirSync(SCANS_DIR, { recursive: true });
  }
}

function mapDbRowToEvaluatedJob(r: any): EvaluatedJob {
  let evidence: string[] = [];
  let techStack: string[] = [];
  let concerns: string[] = [];
  let subScores: any = null;
  try {
    evidence = JSON.parse(r.strengths_json || '[]');
  } catch {
    evidence = [];
  }
  try {
    techStack = JSON.parse(r.tech_stack_json || '[]');
  } catch {
    techStack = [];
  }
  try {
    concerns = JSON.parse(r.concerns_json || '[]');
  } catch {
    concerns = [];
  }
  try {
    subScores = r.sub_scores_json ? JSON.parse(r.sub_scores_json) : null;
  } catch {
    subScores = null;
  }

  return {
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location,
    score: r.score,
    tier: (r.tier as any) || (r.score >= 75 ? 'tier_a' : r.score >= 60 ? 'tier_b' : 'tier_c'),
    gateReason: r.gate_reason,
    locationClass: r.location_class,
    subScores,
    salary: r.salary || 'Salary not stated',
    sponsorship: (r.sponsorship as any) || 'unconfirmed',
    isRemote: Boolean(r.is_remote),
    matchReason: r.match_reason || '',
    evidence,
    concerns,
    techStack,
    postedAgo: formatPostedAgo(r.first_published_at, r.first_seen_at),
    source: r.source_type || 'ats',
    channelType: (r.source_type === 'rss' ? 'rss' : 'ats') as any,
    canonicalUrl: r.canonical_url,
    status: (r.status as any) || 'open',
    firstSeenAt: r.first_seen_at,
    lastSeenAt: r.last_seen_at,
    sourcesCount: 1,
    extractedCompanyName: r.company,
  };
}

// ----------------------------------------------------
// Candidate Profile Storage
// ----------------------------------------------------
export function loadCandidateProfile(): CandidateProfile {
  ensureDirectories();
  if (!fs.existsSync(PROFILE_FILE)) {
    throw new Error(`Profile file not found at ${PROFILE_FILE}`);
  }
  const content = fs.readFileSync(PROFILE_FILE, 'utf-8');
  return JSON.parse(content) as CandidateProfile;
}

export function saveCandidateProfile(profile: CandidateProfile): void {
  ensureDirectories();
  profile.updatedAt = new Date().toISOString();
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf-8');
}

export function getSkillName(skill: SkillItem): string {
  return typeof skill === 'string' ? skill : skill.name;
}

export function isSkillVerified(skill: SkillItem): boolean {
  return typeof skill === 'string' ? true : Boolean(skill.verified);
}

export function getVerifiedSkills(profile: CandidateProfile): string[] {
  const verified: string[] = [];
  const categories = Object.values(profile.coreSkills || {});
  for (const list of categories) {
    if (Array.isArray(list)) {
      for (const item of list) {
        if (typeof item === 'string') {
          verified.push(item);
        } else if (item && typeof item === 'object' && item.verified) {
          verified.push(item.name);
        }
      }
    }
  }
  return verified;
}


// ----------------------------------------------------
// Companies Watchlist Storage (SQLite Primary, JSON export)
// ----------------------------------------------------
function loadCompaniesFromJson(): CompanyConfig[] {
  if (!fs.existsSync(COMPANIES_FILE)) return [];
  try {
    const content = fs.readFileSync(COMPANIES_FILE, 'utf-8');
    return JSON.parse(content) as CompanyConfig[];
  } catch {
    return [];
  }
}

export function loadCompanies(): CompanyConfig[] {
  try {
    const rows = sqlite.prepare('SELECT * FROM sources ORDER BY ats, name').all() as any[];
    if (rows && rows.length > 0) {
      return rows.map(r => ({
        id: `comp-${r.slug}`,
        name: r.name,
        ats: r.ats as AtsType,
        slug: r.slug,
        careersUrl: r.careers_url || '',
        priority: 1,
        isActive: Boolean(r.active),
      }));
    }
  } catch (err) {
    console.warn('[Storage] SQLite read failed for sources, falling back to JSON:', err);
  }

  return loadCompaniesFromJson();
}

export function saveCompanies(companies: CompanyConfig[]): void {
  ensureDirectories();
  fs.writeFileSync(COMPANIES_FILE, JSON.stringify(companies, null, 2), 'utf-8');

  // Also sync to SQLite sources
  try {
    const insertSource = sqlite.prepare(`
      INSERT OR REPLACE INTO sources (
        id, ats, slug, name, careers_url, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    sqlite.transaction(() => {
      for (const c of companies) {
        insertSource.run(
          `${c.ats}:${c.slug}`,
          c.ats,
          c.slug,
          c.name,
          c.careersUrl || null,
          c.isActive ? 1 : 0,
          new Date().toISOString()
        );
      }
    })();
  } catch (err) {
    console.error('[Storage] Failed to sync companies to SQLite:', err);
  }
}

export function addCompany(company: Omit<CompanyConfig, 'id'>): CompanyConfig {
  const companies = loadCompanies();
  const id = `comp-${company.name.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
  const newCompany: CompanyConfig = { ...company, id };
  companies.push(newCompany);
  saveCompanies(companies);
  return newCompany;
}

export function toggleCompany(companyId: string, isActive?: boolean): CompanyConfig | null {
  const companies = loadCompanies();
  const found = companies.find(c => c.id === companyId || c.slug === companyId);
  if (!found) return null;
  found.isActive = isActive !== undefined ? isActive : !found.isActive;
  saveCompanies(companies);
  return found;
}

// ----------------------------------------------------
// Canonical Jobs Storage (SQLite Primary, JSON export)
// ----------------------------------------------------
function loadCanonicalJobsFromJson(): EvaluatedJob[] {
  ensureDirectories();
  if (!fs.existsSync(JOBS_FILE)) return [];
  try {
    const content = fs.readFileSync(JOBS_FILE, 'utf-8');
    return JSON.parse(content) as EvaluatedJob[];
  } catch {
    return [];
  }
}

export function loadCanonicalJobs(): EvaluatedJob[] {
  try {
    const rows = sqlite.prepare(`
      SELECT * FROM jobs ORDER BY score DESC, first_seen_at DESC
    `).all() as any[];

    if (rows && rows.length > 0) {
      return rows.map(mapDbRowToEvaluatedJob);
    }
  } catch (err) {
    console.warn('[Storage] SQLite query failed, falling back to jobs.json:', err);
  }

  return loadCanonicalJobsFromJson();
}

export function saveCanonicalJobs(jobs: EvaluatedJob[]): void {
  ensureDirectories();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

/**
 * Upsert jobs into SQLite and export to JSON
 */
export function upsertCanonicalJobs(incomingJobs: EvaluatedJob[]): {
  allJobs: EvaluatedJob[];
  newJobsCount: number;
  updatedJobsCount: number;
} {
  let newJobsCount = 0;
  let updatedJobsCount = 0;
  const now = new Date().toISOString();

  const insertOrUpdate = sqlite.prepare(`
    INSERT INTO jobs (
      id, ats, slug, external_id, title, company, location, location_class,
      canonical_url, apply_url, source_type, score, match_reason,
      strengths_json, concerns_json, tech_stack_json, sponsorship,
      is_remote, salary, status, consecutive_missing_scans,
      first_seen_at, last_seen_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'unknown',
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, 0,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      company = excluded.company,
      location = excluded.location,
      score = excluded.score,
      match_reason = excluded.match_reason,
      strengths_json = excluded.strengths_json,
      concerns_json = excluded.concerns_json,
      tech_stack_json = excluded.tech_stack_json,
      sponsorship = excluded.sponsorship,
      is_remote = excluded.is_remote,
      salary = excluded.salary,
      last_seen_at = excluded.last_seen_at
  `);

  sqlite.transaction(() => {
    for (const job of incomingJobs) {
      const existing = sqlite.prepare('SELECT id FROM jobs WHERE id = ?').get(job.id);
      if (existing) {
        updatedJobsCount++;
      } else {
        newJobsCount++;
      }

      insertOrUpdate.run(
        job.id,
        job.source || 'ats',
        job.extractedCompanyName || job.company || 'unknown',
        job.id,
        job.title,
        job.company,
        job.location,
        job.canonicalUrl,
        job.canonicalUrl,
        job.channelType || 'ats',
        job.score,
        job.matchReason,
        JSON.stringify(job.evidence || []),
        JSON.stringify(job.concerns || []),
        JSON.stringify(job.techStack || []),
        job.sponsorship,
        job.isRemote ? 1 : 0,
        job.salary,
        job.status || 'open',
        job.firstSeenAt || now,
        job.lastSeenAt || now
      );
    }
  })();

  const allJobs = loadCanonicalJobs();
  saveCanonicalJobs(allJobs);

  return { allJobs, newJobsCount, updatedJobsCount };
}

// ----------------------------------------------------
// Runs History Storage (SQLite Primary, JSON sync)
// ----------------------------------------------------
export function loadRunsHistory(): RunHistoryRecord[] {
  try {
    const rows = sqlite.prepare('SELECT * FROM runs ORDER BY started_at DESC').all() as any[];
    if (rows && rows.length > 0) {
      return rows.map(r => ({
        id: r.id,
        timestamp: r.started_at,
        totalRawJobsFetched: r.jobs_seen_count || 0,
        qualifyingJobsCount: r.new_jobs_count || 0,
        sourcesChecked: r.sources_checked || 0,
        status: (r.status as any) || 'completed',
      }));
    }
  } catch (err) {
    console.warn('[Storage] SQLite query failed for runs, falling back to runs.json:', err);
  }

  if (!fs.existsSync(RUNS_FILE)) return [];
  try {
    const content = fs.readFileSync(RUNS_FILE, 'utf-8');
    return JSON.parse(content) as RunHistoryRecord[];
  } catch {
    return [];
  }
}

export function appendRunRecord(record: RunHistoryRecord): void {
  try {
    sqlite.prepare(`
      INSERT OR REPLACE INTO runs (
        id, started_at, finished_at, sources_checked, healthy_sources_count,
        jobs_seen_count, new_jobs_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.timestamp,
      record.timestamp,
      record.sourcesChecked || 0,
      record.sourcesChecked || 0,
      record.totalRawJobsFetched || 0,
      record.qualifyingJobsCount || 0,
      record.status || 'completed'
    );
  } catch (err) {
    console.error('[Storage] Failed to append run to SQLite:', err);
  }

  const runs = loadRunsHistory();
  ensureDirectories();
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf-8');
}

// ----------------------------------------------------
// Rate Limiting & Scan Management
// ----------------------------------------------------
export function checkManualScanRateLimit(): { allowed: boolean; remainingSeconds: number; lastScanTimestamp?: string } {
  ensureDirectories();

  if (!fs.existsSync(RATE_LIMIT_FILE)) {
    return { allowed: true, remainingSeconds: 0 };
  }

  try {
    const raw = fs.readFileSync(RATE_LIMIT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.lastScanTime) {
      return { allowed: true, remainingSeconds: 0 };
    }

    const lastTime = new Date(data.lastScanTime).getTime();
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastTime) / 1000);
    const remainingSeconds = MANUAL_SCAN_COOLDOWN_SECONDS - elapsedSeconds;

    if (remainingSeconds > 0) {
      return { allowed: false, remainingSeconds, lastScanTimestamp: data.lastScanTime };
    }
  } catch (err) {
    console.error('Error reading rate limit file:', err);
  }

  return { allowed: true, remainingSeconds: 0 };
}

export function updateManualScanTimestamp(timestamp: string) {
  ensureDirectories();
  try {
    fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify({ lastScanTime: timestamp }), 'utf-8');
  } catch (err) {
    console.error('Error updating rate limit file:', err);
  }
}

export async function saveScanResult(data: {
  timestamp: string;
  totalRawJobsFetched: number;
  sourcesChecked?: number;
  healthySourcesCount?: number;
  jobs: EvaluatedJob[];
}): Promise<ScanRunData> {
  ensureDirectories();

  const now = new Date(data.timestamp);
  const formattedDate = now.toISOString().replace(/[:.]/g, '-');
  const scanId = `scan_${formattedDate}`;

  const qualifyingCount = data.jobs.filter(j => j.score >= 70).length;

  const scanRecord: ScanRunData = {
    id: scanId,
    timestamp: data.timestamp,
    totalRawJobsFetched: data.totalRawJobsFetched,
    qualifyingJobsCount: qualifyingCount,
    jobs: data.jobs,
  };

  // Upsert jobs into SQLite & JSON
  upsertCanonicalJobs(data.jobs);

  // Log run in SQLite & runs.json with real sources checked
  appendRunRecord({
    id: scanId,
    timestamp: data.timestamp,
    totalRawJobsFetched: data.totalRawJobsFetched,
    qualifyingJobsCount: qualifyingCount,
    sourcesChecked: data.sourcesChecked || 14,
    status: 'completed',
  });

  updateManualScanTimestamp(data.timestamp);

  return scanRecord;
}

export async function listScanHistory(): Promise<Omit<ScanRunData, 'jobs'>[]> {
  const runs = loadRunsHistory();
  return runs.map(r => ({
    id: r.id,
    timestamp: r.timestamp,
    totalRawJobsFetched: r.totalRawJobsFetched,
    qualifyingJobsCount: r.qualifyingJobsCount,
  }));
}

export async function getScanById(scanId: string): Promise<ScanRunData | null> {
  const runs = loadRunsHistory();
  const match = runs.find(r => r.id === scanId);
  if (match) {
    const canonicalJobs = loadCanonicalJobs();
    return {
      id: match.id,
      timestamp: match.timestamp,
      totalRawJobsFetched: match.totalRawJobsFetched,
      qualifyingJobsCount: match.qualifyingJobsCount,
      jobs: canonicalJobs,
    };
  }
  return null;
}
