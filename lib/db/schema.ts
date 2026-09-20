import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
