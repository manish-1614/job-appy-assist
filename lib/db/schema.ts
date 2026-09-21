import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Sources table - ATS employer boards and RSS feeds
 */
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey(), // e.g. "greenhouse:stripe" or "rss:weworkremotely"
  ats: text('ats').notNull(), // 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'rss'
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  feedUrl: text('feed_url'),
  careersUrl: text('careers_url'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastSuccessAt: text('last_success_at'),
  lastErrorAt: text('last_error_at'),
  lastHttpStatus: integer('last_http_status'),
  lastJobCount: integer('last_job_count').default(0),
  createdAt: text('created_at').notNull(),
});

/**
 * Jobs table - Canonical opportunity store with deterministic lifecycle and gating
 */
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(), // Composite: "${ats}:${slug}:${externalId}"
  ats: text('ats').notNull(),
  slug: text('slug').notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  company: text('company').notNull(),
  location: text('location').notNull(),
  locationClass: text('location_class').notNull().default('unknown'), // remote_worldwide | remote_apac_or_india | india_office | jp_kr_onsite_sponsored | region_locked | onsite_elsewhere | unknown
  canonicalUrl: text('canonical_url').notNull(),
  applyUrl: text('apply_url').notNull(),
  sourceType: text('source_type').notNull().default('ats'),
  score: integer('score').notNull().default(0),
  matchReason: text('match_reason'),
  strengthsJson: text('strengths_json'),
  concernsJson: text('concerns_json'),
  techStackJson: text('tech_stack_json'),
  sponsorship: text('sponsorship').notNull().default('unconfirmed'), // 'explicit' | 'possible' | 'unconfirmed'
  isRemote: integer('is_remote', { mode: 'boolean' }).notNull().default(false),
  salary: text('salary').default('Salary not stated'),
  tier: text('tier').notNull().default('tier_c'), // 'tier_a' | 'tier_b' | 'tier_c'
  subScoresJson: text('sub_scores_json'),
  extractedFactsJson: text('extracted_facts_json'),
  status: text('status').notNull().default('open'), // 'open' | 'closed' | 'needs_check'
  gateReason: text('gate_reason'),
  consecutiveMissingScans: integer('consecutive_missing_scans').notNull().default(0),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  firstPublishedAt: text('first_published_at'),
  rawJson: text('raw_json'),
}, (table) => ({
  statusIdx: index('jobs_status_idx').on(table.status),
  scoreIdx: index('jobs_score_idx').on(table.score),
  tierIdx: index('jobs_tier_idx').on(table.tier),
  companyIdx: index('jobs_company_idx').on(table.company),
  canonicalUrlIdx: index('jobs_canonical_url_idx').on(table.canonicalUrl),
  identityIdx: uniqueIndex('jobs_identity_idx').on(table.ats, table.slug, table.externalId),
}));

/**
 * Job descriptions - Persisted clean text and content hash (F4)
 */
export const jobDescriptions = sqliteTable('job_descriptions', {
  jobId: text('job_id').primaryKey().references(() => jobs.id, { onDelete: 'cascade' }),
  contentHash: text('content_hash').notNull(),
  descriptionText: text('description_text').notNull(),
  descriptionHtml: text('description_html'),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Job events - Append-only lifecycle tracking audit log (F5, F6)
 */
export const jobEvents = sqliteTable('job_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // 'discovered' | 'updated' | 'missing_scan' | 'closed' | 'reopened'
  createdAt: text('created_at').notNull(),
  payloadJson: text('payload_json'),
}, (table) => ({
  jobEventIdx: index('job_events_job_id_idx').on(table.jobId),
}));

/**
 * Runs - Ingestion scan audit log (F16, F18)
 */
export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  sourcesChecked: integer('sources_checked').notNull().default(0),
  healthySourcesCount: integer('healthy_sources_count').notNull().default(0),
  jobsSeenCount: integer('jobs_seen_count').notNull().default(0),
  newJobsCount: integer('new_jobs_count').notNull().default(0),
  closedJobsCount: integer('closed_jobs_count').notNull().default(0),
  status: text('status').notNull().default('running'), // 'running' | 'completed' | 'failed'
  error: text('error'),
});

/**
 * Reserved for Phase 3: Applications & Kanban Tracker
 */
export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  jobId: text('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('saved'), // 'saved' | 'applied' | 'screening' | 'interview' | 'offer' | 'accepted' | 'rejected' | 'withdrawn' | 'ghosted'
  channel: text('channel').default('direct'), // 'direct' | 'referral' | 'recruiter' | 'other'
  appliedAt: text('applied_at'),
  resumeVersionId: text('resume_version_id'),
  coverLetterId: text('cover_letter_id'),
  contactsJson: text('contacts_json'),
  nextFollowUpAt: text('next_follow_up_at'),
  notes: text('notes'),
  outcomeReason: text('outcome_reason'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const applicationEvents = sqliteTable('application_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  applicationId: text('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  createdAt: text('created_at').notNull(),
  payloadJson: text('payload_json'),
});

/**
 * Reserved for Phase 4: Application Kit
 */
export const kitAchievements = sqliteTable('kit_achievements', {
  id: text('id').primaryKey(),
  employerOrProject: text('employer_or_project').notNull(),
  claim: text('claim').notNull(),
  metric: text('metric'),
  period: text('period'),
  evidence: text('evidence'),
  skillsJson: text('skills_json'),
  verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
});

/**
 * Phase 2: Structured Job Extractions cache and facts store
 */
export const jobExtractions = sqliteTable('job_extractions', {
  jobId: text('job_id').primaryKey().references(() => jobs.id, { onDelete: 'cascade' }),
  contentHash: text('content_hash').notNull(),
  promptVersion: text('prompt_version').notNull(),
  model: text('model').notNull(),
  extractedAt: text('extracted_at').notNull(),
  extractionStatus: text('extraction_status').notNull().default('success'), // 'success' | 'failed'
  extractedJson: text('extracted_json').notNull(),
  subScoresJson: text('sub_scores_json'),
  tier: text('tier').notNull().default('tier_c'),
}, (table) => ({
  cacheIdx: index('job_extractions_cache_idx').on(table.contentHash, table.promptVersion, table.model),
}));

/**
 * Phase 2: User Calibration Labels (thumbs up/down with reason codes)
 */
export const jobLabels = sqliteTable('job_labels', {
  jobId: text('job_id').primaryKey().references(() => jobs.id, { onDelete: 'cascade' }),
  label: text('label').notNull(), // 'up' | 'down'
  reasonCode: text('reason_code').notNull(), // 'good_match' | 'bad_stack' | 'not_remote' | 'bad_location' | 'overqualified' | 'underqualified' | 'low_comp' | 'presales_heavy' | 'other'
  notes: text('notes'),
  labeledAt: text('labeled_at').notNull(),
});

/**
 * Mock-Interview Module Tables (Phase 3)
 */
export const interviewSessions = sqliteTable('interview_sessions', {
  id: text('id').primaryKey(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  companyStyle: text('company_style').notNull(), // 'google' | 'toptal'
  roundType: text('round_type').notNull(), // 'system_design' | 'advanced_dsa_cpp' | 'behavioral' | 'communication'
  questionId: text('question_id').notNull(),
  liveModel: text('live_model').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'completed' | 'aborted'
  configJson: text('config_json'),
  costUsdEst: real('cost_usd_est').default(0),
  costInrEst: real('cost_inr_est').default(0),
}, (table) => ({
  statusIdx: index('interview_sessions_status_idx').on(table.status),
  startedAtIdx: index('interview_sessions_started_at_idx').on(table.startedAt),
}));

export const interviewTurns = sqliteTable('interview_turns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  speaker: text('speaker').notNull(), // 'candidate' | 'interviewer' | 'system'
  text: text('text').notNull(),
  tOffsetMs: integer('t_offset_ms').notNull(),
  source: text('source').notNull().default('audio_transcript'), // 'audio_transcript' | 'internal'
}, (table) => ({
  sessionSeqIdx: index('interview_turns_session_seq_idx').on(table.sessionId, table.seq),
}));

export const interviewEvents = sqliteTable('interview_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  tOffsetMs: integer('t_offset_ms').notNull(),
  kind: text('kind').notNull(), // 'snapshot' | 'observer_read' | 'interjection' | 'hint_rung' | 'error' | 'goaway' | 'resume'
  payloadJson: text('payload_json'),
}, (table) => ({
  sessionKindIdx: index('interview_events_session_kind_idx').on(table.sessionId, table.kind),
}));

export const interviewSnapshots = sqliteTable('interview_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  tOffsetMs: integer('t_offset_ms').notNull(),
  kind: text('kind').notNull(), // 'code' | 'diagram'
  contentHash: text('content_hash').notNull(),
  contentText: text('content_text').notNull(),
}, (table) => ({
  sessionHashIdx: index('interview_snapshots_session_hash_idx').on(table.sessionId, table.contentHash),
}));

export const interviewScores = sqliteTable('interview_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').notNull().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  dimension: text('dimension').notNull(),
  score: real('score').notNull(),
  evidenceJson: text('evidence_json'),
  graderModel: text('grader_model').notNull(),
}, (table) => ({
  sessionScoreIdx: index('interview_scores_session_idx').on(table.sessionId),
}));

export const interviewUsage = sqliteTable('interview_usage', {
  sessionId: text('session_id').primaryKey().references(() => interviewSessions.id, { onDelete: 'cascade' }),
  inputAudioTokens: integer('input_audio_tokens').notNull().default(0),
  outputAudioTokens: integer('output_audio_tokens').notNull().default(0),
  textIn: integer('text_in').notNull().default(0),
  textOut: integer('text_out').notNull().default(0),
  costUsdEst: real('cost_usd_est').notNull().default(0),
});

