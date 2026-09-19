import fs from 'fs';
import path from 'path';
import { EvaluatedJob, AtsType } from './ats-adapters';

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
    languages: string[];
    backendAndDistributed: string[];
    aiAndWorkflowAutomation: string[];
    cloudAndDevOps: string[];
    databases: string[];
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

// ----------------------------------------------------
// Companies Watchlist Storage
// ----------------------------------------------------
export function loadCompanies(): CompanyConfig[] {
  ensureDirectories();
  if (!fs.existsSync(COMPANIES_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(COMPANIES_FILE, 'utf-8');
    return JSON.parse(content) as CompanyConfig[];
  } catch (err) {
    console.error('Failed to parse companies.json:', err);
    return [];
  }
}

export function saveCompanies(companies: CompanyConfig[]): void {
  ensureDirectories();
  fs.writeFileSync(COMPANIES_FILE, JSON.stringify(companies, null, 2), 'utf-8');
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
  const found = companies.find(c => c.id === companyId);
  if (!found) return null;
  found.isActive = isActive !== undefined ? isActive : !found.isActive;
  saveCompanies(companies);
  return found;
}

// ----------------------------------------------------
// Canonical Jobs Storage & Upsert
// ----------------------------------------------------
export function loadCanonicalJobs(): EvaluatedJob[] {
  ensureDirectories();
  if (!fs.existsSync(JOBS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(JOBS_FILE, 'utf-8');
    return JSON.parse(content) as EvaluatedJob[];
  } catch (err) {
    console.error('Failed to parse jobs.json:', err);
    return [];
  }
}

export function saveCanonicalJobs(jobs: EvaluatedJob[]): void {
  ensureDirectories();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

/**
 * Upsert newly scanned jobs into canonical jobs.json, preserving firstSeenAt,
 * updating lastSeenAt, appending source corroboration, and keeping status.
 */
export function upsertCanonicalJobs(incomingJobs: EvaluatedJob[]): {
  allJobs: EvaluatedJob[];
  newJobsCount: number;
  updatedJobsCount: number;
} {
  const existingJobs = loadCanonicalJobs();
  const jobMap = new Map<string, EvaluatedJob>();

  existingJobs.forEach(job => {
    jobMap.set(job.id, job);
  });

  let newJobsCount = 0;
  let updatedJobsCount = 0;

  incomingJobs.forEach(incoming => {
    const existing = jobMap.get(incoming.id);
    if (!existing) {
      jobMap.set(incoming.id, incoming);
      newJobsCount++;
    } else {
      // Merge updates
      existing.lastSeenAt = incoming.lastSeenAt || new Date().toISOString();
      existing.score = incoming.score;
      existing.matchReason = incoming.matchReason;
      existing.evidence = incoming.evidence;
      existing.techStack = incoming.techStack;
      if (incoming.source && !existing.source.includes(incoming.source)) {
        existing.source = `${existing.source} + ${incoming.source}`;
        existing.sourcesCount = (existing.sourcesCount || 1) + 1;
      }
      updatedJobsCount++;
    }
  });

  const allJobs = Array.from(jobMap.values());
  // Sort descending by score
  allJobs.sort((a, b) => b.score - a.score);
  saveCanonicalJobs(allJobs);

  return { allJobs, newJobsCount, updatedJobsCount };
}

// ----------------------------------------------------
// Runs History Storage
// ----------------------------------------------------
export function loadRunsHistory(): RunHistoryRecord[] {
  ensureDirectories();
  if (!fs.existsSync(RUNS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(RUNS_FILE, 'utf-8');
    return JSON.parse(content) as RunHistoryRecord[];
  } catch (err) {
    console.error('Failed to parse runs.json:', err);
    return [];
  }
}

export function appendRunRecord(record: RunHistoryRecord): void {
  const runs = loadRunsHistory();
  // prepend newest run
  runs.unshift(record);
  ensureDirectories();
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs, null, 2), 'utf-8');
}

// ----------------------------------------------------
// Rate Limiting & Backward Compatibility
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
  jobs: EvaluatedJob[];
}): Promise<ScanRunData> {
  ensureDirectories();

  const now = new Date(data.timestamp);
  const formattedDate = now.toISOString().replace(/[:.]/g, '-');
  const scanId = `scan_${formattedDate}`;

  const scanRecord: ScanRunData = {
    id: scanId,
    timestamp: data.timestamp,
    totalRawJobsFetched: data.totalRawJobsFetched,
    qualifyingJobsCount: data.jobs.filter(j => j.score >= 70).length,
    jobs: data.jobs,
  };

  const filePath = path.join(SCANS_DIR, `${scanId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(scanRecord, null, 2), 'utf-8');

  // Also upsert canonical jobs
  upsertCanonicalJobs(data.jobs);

  // Also log into runs.json
  appendRunRecord({
    id: scanId,
    timestamp: data.timestamp,
    totalRawJobsFetched: data.totalRawJobsFetched,
    qualifyingJobsCount: scanRecord.qualifyingJobsCount,
    sourcesChecked: 10,
    status: 'completed',
  });

  // Update rate limit timestamp
  updateManualScanTimestamp(data.timestamp);

  return scanRecord;
}

export async function listScanHistory(): Promise<Omit<ScanRunData, 'jobs'>[]> {
  const runs = loadRunsHistory();
  if (runs.length > 0) {
    return runs.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      totalRawJobsFetched: r.totalRawJobsFetched,
      qualifyingJobsCount: r.qualifyingJobsCount,
    }));
  }

  ensureDirectories();
  try {
    const files = fs.readdirSync(SCANS_DIR).filter(f => f.endsWith('.json') && f !== 'rate_limit.json');
    const historyList: Omit<ScanRunData, 'jobs'>[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(SCANS_DIR, file);
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(rawContent) as ScanRunData;
        if (parsed.id && parsed.timestamp) {
          historyList.push({
            id: parsed.id,
            timestamp: parsed.timestamp,
            totalRawJobsFetched: parsed.totalRawJobsFetched || 0,
            qualifyingJobsCount: parsed.qualifyingJobsCount || 0,
          });
        }
      } catch (e) {
        console.error(`Failed to parse scan history file ${file}:`, e);
      }
    }

    historyList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return historyList;
  } catch (err) {
    console.error('Failed to list scan history:', err);
    return [];
  }
}

export async function getScanById(scanId: string): Promise<ScanRunData | null> {
  ensureDirectories();
  const filePath = path.join(SCANS_DIR, `${scanId}.json`);

  if (!fs.existsSync(filePath)) {
    // If not found in scans dir, check if it's in runs and return canonical jobs
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

  try {
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(rawContent) as ScanRunData;
  } catch (err) {
    console.error(`Failed to read scan file ${scanId}:`, err);
    return null;
  }
}
