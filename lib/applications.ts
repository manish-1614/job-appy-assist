import { sqlite } from './db';
import crypto from 'crypto';

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted';

export type ApplicationChannel = 'direct' | 'referral' | 'recruiter' | 'other';

export interface ApplicationContact {
  name: string;
  email?: string;
  role?: string;
  notes?: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  channel: ApplicationChannel;
  appliedAt?: string;
  resumeVersionId?: string;
  coverLetterId?: string;
  contacts?: ApplicationContact[];
  nextFollowUpAt?: string;
  notes?: string;
  outcomeReason?: string;
  createdAt: string;
  updatedAt: string;
  // Joined job fields
  title?: string;
  company?: string;
  location?: string;
  tier?: string;
  score?: number;
  jobStatus?: string;
  canonicalUrl?: string;
  applyUrl?: string;
}

export interface ApplicationEventRecord {
  id: number;
  applicationId: string;
  eventType: string;
  createdAt: string;
  payload?: any;
}

export interface TrackJobOptions {
  channel?: ApplicationChannel;
  appliedAt?: string;
  resumeVersionId?: string;
  coverLetterId?: string;
  contacts?: ApplicationContact[];
  notes?: string;
}

/**
 * Calculates next follow-up timestamp based on standard cadences:
 * - 'applied': +7 days, +14 days, +30 days (ghosted suggestion)
 * - 'interview': +1 day (24 hours thank you)
 * - other active: +7 days
 * - terminal states: undefined
 */
export function calculateNextFollowUp(
  status: ApplicationStatus,
  appliedAtIso?: string,
  followUpsSentCount: number = 0,
  referenceDate: Date = new Date()
): string | undefined {
  const terminalStates: ApplicationStatus[] = ['accepted', 'rejected', 'withdrawn', 'ghosted'];
  if (terminalStates.includes(status)) {
    return undefined;
  }

  const baseDate = appliedAtIso ? new Date(appliedAtIso) : new Date(referenceDate);

  if (status === 'applied') {
    const daysToAdd = followUpsSentCount === 0 ? 7 : followUpsSentCount === 1 ? 14 : 30;
    const target = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return target.toISOString();
  }

  if (status === 'interview') {
    const target = new Date(referenceDate.getTime() + 1 * 24 * 60 * 60 * 1000);
    return target.toISOString();
  }

  if (status === 'screening') {
    const target = new Date(referenceDate.getTime() + 5 * 24 * 60 * 60 * 1000);
    return target.toISOString();
  }

  return undefined;
}

/**
 * Record an immutable application event into application_events
 */
export function recordApplicationEvent(
  applicationId: string,
  eventType: string,
  payload?: any
): void {
  const now = new Date().toISOString();
  sqlite
    .prepare(
      `INSERT INTO application_events (application_id, event_type, created_at, payload_json)
       VALUES (?, ?, ?, ?)`
    )
    .run(applicationId, eventType, now, payload ? JSON.stringify(payload) : null);

  sqlite
    .prepare(`UPDATE applications SET updated_at = ? WHERE id = ?`)
    .run(now, applicationId);
}

/**
 * Creates or updates an application record for a given job.
 * Appends an event to application_events.
 */
export function trackJob(
  jobId: string,
  status: ApplicationStatus = 'saved',
  options: TrackJobOptions = {}
): ApplicationRecord {
  const now = new Date().toISOString();
  const existing = sqlite
    .prepare(`SELECT * FROM applications WHERE job_id = ?`)
    .get(jobId) as any;

  let appId = existing?.id;
  const appliedAt = status !== 'saved' ? options.appliedAt || existing?.applied_at || now : existing?.applied_at;
  const nextFollowUpAt = calculateNextFollowUp(status, appliedAt, 0);

  if (existing) {
    sqlite
      .prepare(
        `UPDATE applications 
         SET status = ?, 
             channel = COALESCE(?, channel),
             applied_at = COALESCE(?, applied_at),
             resume_version_id = COALESCE(?, resume_version_id),
             cover_letter_id = COALESCE(?, cover_letter_id),
             contacts_json = COALESCE(?, contacts_json),
             next_follow_up_at = ?,
             notes = COALESCE(?, notes),
             updated_at = ?
         WHERE id = ?`
      )
      .run(
        status,
        options.channel || null,
        appliedAt || null,
        options.resumeVersionId || null,
        options.coverLetterId || null,
        options.contacts ? JSON.stringify(options.contacts) : null,
        nextFollowUpAt || null,
        options.notes || null,
        now,
        appId
      );

    recordApplicationEvent(appId, status === existing.status ? 'application_updated' : 'status_change', {
      previousStatus: existing.status,
      newStatus: status,
      notes: options.notes,
    });
  } else {
    appId = `app_${crypto.randomUUID()}`;
    sqlite
      .prepare(
        `INSERT INTO applications (
           id, job_id, status, channel, applied_at, resume_version_id, cover_letter_id,
           contacts_json, next_follow_up_at, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        appId,
        jobId,
        status,
        options.channel || 'direct',
        appliedAt || null,
        options.resumeVersionId || null,
        options.coverLetterId || null,
        options.contacts ? JSON.stringify(options.contacts) : null,
        nextFollowUpAt || null,
        options.notes || null,
        now,
        now
      );

    recordApplicationEvent(appId, status, {
      initialStatus: status,
      channel: options.channel || 'direct',
      notes: options.notes,
    });
  }

  return getApplicationById(appId)!;
}

/**
 * Transition application to a new status
 */
export function updateApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  options: {
    notes?: string;
    outcomeReason?: string;
    channel?: ApplicationChannel;
    contacts?: ApplicationContact[];
    nextFollowUpAt?: string;
  } = {}
): ApplicationRecord {
  const current = getApplicationById(applicationId);
  if (!current) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const now = new Date().toISOString();
  const appliedAt =
    newStatus !== 'saved' && !current.appliedAt ? now : current.appliedAt;
  const nextFollowUpAt =
    options.nextFollowUpAt !== undefined
      ? options.nextFollowUpAt
      : calculateNextFollowUp(newStatus, appliedAt, 0);

  sqlite
    .prepare(
      `UPDATE applications
       SET status = ?,
           applied_at = ?,
           notes = COALESCE(?, notes),
           outcome_reason = COALESCE(?, outcome_reason),
           channel = COALESCE(?, channel),
           contacts_json = COALESCE(?, contacts_json),
           next_follow_up_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .run(
      newStatus,
      appliedAt || null,
      options.notes || null,
      options.outcomeReason || null,
      options.channel || null,
      options.contacts ? JSON.stringify(options.contacts) : null,
      nextFollowUpAt || null,
      now,
      applicationId
    );

  recordApplicationEvent(applicationId, 'status_change', {
    previousStatus: current.status,
    newStatus,
    notes: options.notes,
    outcomeReason: options.outcomeReason,
  });

  return getApplicationById(applicationId)!;
}

/**
 * Retrieve single application by ID
 */
export function getApplicationById(id: string): ApplicationRecord | null {
  const row = sqlite
    .prepare(
      `SELECT a.*, 
              j.title, j.company, j.location, j.tier, j.score, j.status as job_status,
              j.canonical_url, j.apply_url
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.id = ?`
    )
    .get(id) as any;

  if (!row) return null;
  return formatApplicationRow(row);
}

/**
 * Retrieve application by jobId
 */
export function getApplicationByJobId(jobId: string): ApplicationRecord | null {
  const row = sqlite
    .prepare(
      `SELECT a.*, 
              j.title, j.company, j.location, j.tier, j.score, j.status as job_status,
              j.canonical_url, j.apply_url
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.job_id = ?`
    )
    .get(jobId) as any;

  if (!row) return null;
  return formatApplicationRow(row);
}

/**
 * List applications with optional filter
 */
export function listApplications(filter?: {
  status?: ApplicationStatus;
  search?: string;
}): ApplicationRecord[] {
  let query = `
    SELECT a.*, 
           j.title, j.company, j.location, j.tier, j.score, j.status as job_status,
           j.canonical_url, j.apply_url
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filter?.status) {
    query += ` AND a.status = ?`;
    params.push(filter.status);
  }

  if (filter?.search) {
    query += ` AND (j.title LIKE ? OR j.company LIKE ?)`;
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }

  query += ` ORDER BY a.updated_at DESC`;

  const rows = sqlite.prepare(query).all(...params) as any[];
  return rows.map(formatApplicationRow);
}

/**
 * Get timeline events for an application
 */
export function getApplicationEvents(applicationId: string): ApplicationEventRecord[] {
  const rows = sqlite
    .prepare(`SELECT * FROM application_events WHERE application_id = ? ORDER BY id DESC`)
    .all(applicationId) as any[];

  return rows.map((r) => ({
    id: r.id,
    applicationId: r.application_id,
    eventType: r.event_type,
    createdAt: r.created_at,
    payload: r.payload_json ? JSON.parse(r.payload_json) : undefined,
  }));
}

/**
 * Delete an application record
 */
export function deleteApplication(applicationId: string): boolean {
  const info = sqlite.prepare(`DELETE FROM applications WHERE id = ?`).run(applicationId);
  return info.changes > 0;
}

/**
 * Check if any actively tracked jobs were closed by their employers.
 * Appends 'job_closed_by_employer' alert event if not already logged.
 */
export function checkClosedTrackedJobs(): Array<{
  applicationId: string;
  jobId: string;
  title: string;
  company: string;
}> {
  const activeStatuses = ['saved', 'applied', 'screening', 'interview'];
  const placeholders = activeStatuses.map(() => '?').join(',');

  const rows = sqlite
    .prepare(
      `SELECT a.id as application_id, a.job_id, j.title, j.company
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.status IN (${placeholders}) AND j.status = 'closed'`
    )
    .all(...activeStatuses) as Array<{
      application_id: string;
      job_id: string;
      title: string;
      company: string;
    }>;

  const alerts: Array<{
    applicationId: string;
    jobId: string;
    title: string;
    company: string;
  }> = [];

  for (const row of rows) {
    const existingAlert = sqlite
      .prepare(
        `SELECT id FROM application_events 
         WHERE application_id = ? AND event_type = 'job_closed_by_employer'`
      )
      .get(row.application_id);

    if (!existingAlert) {
      recordApplicationEvent(row.application_id, 'job_closed_by_employer', {
        title: row.title,
        company: row.company,
        closedAt: new Date().toISOString(),
      });
    }

    alerts.push({
      applicationId: row.application_id,
      jobId: row.job_id,
      title: row.title,
      company: row.company,
    });
  }

  return alerts;
}

/**
 * Computes data for the Today cockpit
 */
export function getTodayCockpit() {
  const now = new Date();

  // 1. Weekly Goal Progress (Monday 00:00 to now)
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diffToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfWeekIso = startOfWeek.toISOString();

  const weeklyAppliedRows = sqlite
    .prepare(
      `SELECT count(*) as cnt FROM applications 
       WHERE status != 'saved' AND (applied_at >= ? OR updated_at >= ?)`
    )
    .get(startOfWeekIso, startOfWeekIso) as { cnt: number };

  const weeklyTarget = 10; // D11 decision
  const completed = weeklyAppliedRows?.cnt || 0;
  const remaining = Math.max(0, weeklyTarget - completed);
  const percent = Math.min(100, Math.round((completed / weeklyTarget) * 100));

  // 2. Follow-ups due
  const followUpsDueRows = sqlite
    .prepare(
      `SELECT a.*, j.title, j.company, j.location, j.tier, j.score, j.canonical_url, j.apply_url
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.status IN ('applied', 'screening', 'interview') 
         AND a.next_follow_up_at IS NOT NULL 
         AND a.next_follow_up_at <= ?
       ORDER BY a.next_follow_up_at ASC`
    )
    .all(now.toISOString()) as any[];

  // 3. Tracked jobs closed by employer alerts
  const closedTrackedAlerts = checkClosedTrackedJobs();

  // 4. Saved jobs at risk (>30 days old or missing scan)
  const savedAtRiskRows = sqlite
    .prepare(
      `SELECT a.*, j.title, j.company, j.location, j.first_seen_at, j.consecutive_missing_scans
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.status = 'saved' 
         AND (j.consecutive_missing_scans > 0 OR j.first_seen_at <= date('now', '-30 days'))
       ORDER BY j.consecutive_missing_scans DESC, j.first_seen_at ASC`
    )
    .all() as any[];

  // 5. New Tier A jobs (last 48 hours)
  const newTierARows = sqlite
    .prepare(
      `SELECT j.id, j.title, j.company, j.location, j.score, j.first_seen_at, j.canonical_url, j.apply_url
       FROM jobs j
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE j.tier = 'tier_a' AND j.status = 'open' AND a.id IS NULL
       ORDER BY j.first_seen_at DESC, j.score DESC
       LIMIT 10`
    )
    .all() as any[];

  // Total tracked count
  const totalTrackedRow = sqlite
    .prepare(`SELECT count(*) as cnt FROM applications`)
    .get() as { cnt: number };

  return {
    weeklyGoal: {
      target: weeklyTarget,
      completed,
      remaining,
      percent,
      startOfWeek: startOfWeekIso,
    },
    followUpsDue: followUpsDueRows.map(formatApplicationRow),
    closedTrackedAlerts,
    savedAtRisk: savedAtRiskRows.map(formatApplicationRow),
    newTierAJobs: newTierARows,
    trackedCount: totalTrackedRow?.cnt || 0,
  };
}

/**
 * Funnel insights and conversion analytics
 */
export function getFunnelInsights() {
  const allApplications = listApplications();

  const byStage: Record<string, number> = {
    saved: 0,
    applied: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    accepted: 0,
    rejected: 0,
    withdrawn: 0,
    ghosted: 0,
  };

  const byChannel: Record<string, number> = {};
  const byTier: Record<string, number> = {};

  for (const app of allApplications) {
    byStage[app.status] = (byStage[app.status] || 0) + 1;
    byChannel[app.channel] = (byChannel[app.channel] || 0) + 1;
    const tier = app.tier || 'unclassified';
    byTier[tier] = (byTier[tier] || 0) + 1;
  }

  // Response rate: percentage of applied+ applications that got screening, interview, offer, accepted, or rejected
  const appliedOrBeyond =
    allApplications.length - (byStage['saved'] || 0);

  const responses =
    (byStage['screening'] || 0) +
    (byStage['interview'] || 0) +
    (byStage['offer'] || 0) +
    (byStage['accepted'] || 0);

  const responseRate =
    appliedOrBeyond > 0 ? Math.round((responses / appliedOrBeyond) * 100) : 0;

  return {
    totalTracked: allApplications.length,
    appliedOrBeyond,
    byStage,
    byChannel,
    byTier,
    responseRate,
  };
}

function formatApplicationRow(row: any): ApplicationRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    status: row.status as ApplicationStatus,
    channel: (row.channel as ApplicationChannel) || 'direct',
    appliedAt: row.applied_at || undefined,
    resumeVersionId: row.resume_version_id || undefined,
    coverLetterId: row.cover_letter_id || undefined,
    contacts: row.contacts_json ? JSON.parse(row.contacts_json) : undefined,
    nextFollowUpAt: row.next_follow_up_at || undefined,
    notes: row.notes || undefined,
    outcomeReason: row.outcome_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title || undefined,
    company: row.company || undefined,
    location: row.location || undefined,
    tier: row.tier || undefined,
    score: row.score !== undefined ? Number(row.score) : undefined,
    jobStatus: row.job_status || undefined,
    canonicalUrl: row.canonical_url || undefined,
    applyUrl: row.apply_url || undefined,
  };
}
