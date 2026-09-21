import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'job_appy.db');

// Initialize better-sqlite3 with WAL mode, busy timeout, and foreign keys enabled
export const sqlite = new Database(DB_PATH, { timeout: 15000 });
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 15000');

export const db = drizzle(sqlite, { schema });

/**
 * Initialize all database tables and indexes idempotently
 */
export function initDb() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      ats TEXT NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      feed_url TEXT,
      careers_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      last_success_at TEXT,
      last_error_at TEXT,
      last_http_status INTEGER,
      last_job_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      ats TEXT NOT NULL,
      slug TEXT NOT NULL,
      external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      location_class TEXT NOT NULL DEFAULT 'unknown',
      canonical_url TEXT NOT NULL,
      apply_url TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'ats',
      score INTEGER NOT NULL DEFAULT 0,
      match_reason TEXT,
      strengths_json TEXT,
      concerns_json TEXT,
      tech_stack_json TEXT,
      sponsorship TEXT NOT NULL DEFAULT 'unconfirmed',
      is_remote INTEGER NOT NULL DEFAULT 0,
      salary TEXT DEFAULT 'Salary not stated',
      status TEXT NOT NULL DEFAULT 'open',
      gate_reason TEXT,
      consecutive_missing_scans INTEGER NOT NULL DEFAULT 0,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      first_published_at TEXT,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status);
    CREATE INDEX IF NOT EXISTS jobs_score_idx ON jobs (score);
    CREATE INDEX IF NOT EXISTS jobs_company_idx ON jobs (company);
    CREATE INDEX IF NOT EXISTS jobs_canonical_url_idx ON jobs (canonical_url);
    CREATE UNIQUE INDEX IF NOT EXISTS jobs_identity_idx ON jobs (ats, slug, external_id);

    CREATE TABLE IF NOT EXISTS job_descriptions (
      job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      description_text TEXT NOT NULL,
      description_html TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT
    );

    CREATE INDEX IF NOT EXISTS job_events_job_id_idx ON job_events (job_id);

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      sources_checked INTEGER NOT NULL DEFAULT 0,
      healthy_sources_count INTEGER NOT NULL DEFAULT 0,
      jobs_seen_count INTEGER NOT NULL DEFAULT 0,
      new_jobs_count INTEGER NOT NULL DEFAULT 0,
      closed_jobs_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'saved',
      channel TEXT DEFAULT 'direct',
      applied_at TEXT,
      resume_version_id TEXT,
      cover_letter_id TEXT,
      contacts_json TEXT,
      next_follow_up_at TEXT,
      notes TEXT,
      outcome_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS application_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload_json TEXT
    );

    CREATE TABLE IF NOT EXISTS kit_achievements (
      id TEXT PRIMARY KEY,
      employer_or_project TEXT NOT NULL,
      claim TEXT NOT NULL,
      metric TEXT,
      period TEXT,
      evidence TEXT,
      skills_json TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_extractions (
      job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      model TEXT NOT NULL,
      extracted_at TEXT NOT NULL,
      extraction_status TEXT NOT NULL DEFAULT 'success',
      extracted_json TEXT NOT NULL,
      sub_scores_json TEXT,
      tier TEXT NOT NULL DEFAULT 'tier_c'
    );
    CREATE INDEX IF NOT EXISTS job_extractions_cache_idx ON job_extractions (content_hash, prompt_version, model);

    CREATE TABLE IF NOT EXISTS job_labels (
      job_id TEXT PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      notes TEXT,
      labeled_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interview_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      company_style TEXT NOT NULL,
      round_type TEXT NOT NULL,
      question_id TEXT NOT NULL,
      live_model TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      config_json TEXT,
      cost_usd_est REAL DEFAULT 0,
      cost_inr_est REAL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS interview_sessions_status_idx ON interview_sessions (status);
    CREATE INDEX IF NOT EXISTS interview_sessions_started_at_idx ON interview_sessions (started_at);

    CREATE TABLE IF NOT EXISTS interview_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
      seq INTEGER NOT NULL,
      speaker TEXT NOT NULL,
      text TEXT NOT NULL,
      t_offset_ms INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'audio_transcript'
    );
    CREATE INDEX IF NOT EXISTS interview_turns_session_seq_idx ON interview_turns (session_id, seq);

    CREATE TABLE IF NOT EXISTS interview_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
      t_offset_ms INTEGER NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT
    );
    CREATE INDEX IF NOT EXISTS interview_events_session_kind_idx ON interview_events (session_id, kind);

    CREATE TABLE IF NOT EXISTS interview_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
      t_offset_ms INTEGER NOT NULL,
      kind TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      content_text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS interview_snapshots_session_hash_idx ON interview_snapshots (session_id, content_hash);

    CREATE TABLE IF NOT EXISTS interview_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
      dimension TEXT NOT NULL,
      score REAL NOT NULL,
      evidence_json TEXT,
      grader_model TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS interview_scores_session_idx ON interview_scores (session_id);

    CREATE TABLE IF NOT EXISTS interview_usage (
      session_id TEXT PRIMARY KEY REFERENCES interview_sessions(id) ON DELETE CASCADE,
      input_audio_tokens INTEGER NOT NULL DEFAULT 0,
      output_audio_tokens INTEGER NOT NULL DEFAULT 0,
      text_in INTEGER NOT NULL DEFAULT 0,
      text_out INTEGER NOT NULL DEFAULT 0,
      cost_usd_est REAL NOT NULL DEFAULT 0
    );
  `);

  // Ensure Phase 2 columns exist on jobs table
  try {
    const tableInfo = sqlite.pragma('table_info(jobs)') as Array<{ name: string }>;
    const existingCols = new Set(tableInfo.map((c) => c.name));
    if (!existingCols.has('tier')) {
      sqlite.exec(`ALTER TABLE jobs ADD COLUMN tier TEXT NOT NULL DEFAULT 'tier_c'`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS jobs_tier_idx ON jobs (tier)`);
    }
    if (!existingCols.has('sub_scores_json')) {
      sqlite.exec(`ALTER TABLE jobs ADD COLUMN sub_scores_json TEXT`);
    }
    if (!existingCols.has('extracted_facts_json')) {
      sqlite.exec(`ALTER TABLE jobs ADD COLUMN extracted_facts_json TEXT`);
    }
  } catch (err) {
    console.warn('Note: Could not run alter table pragma check:', err);
  }
}

// Auto-initialize tables
initDb();
