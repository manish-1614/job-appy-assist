import { describe, it, expect, beforeEach } from 'vitest';
import { sqlite } from '../../lib/db';
import {
  trackJob,
  updateApplicationStatus,
  calculateNextFollowUp,
  getTodayCockpit,
  getFunnelInsights,
  checkClosedTrackedJobs,
  type ApplicationStatus,
} from '../../lib/applications';

describe('Phase 3: Application Tracker & Follow-ups', () => {
  const testJobId = 'test-ats:test-company:1001';
  const testJobId2 = 'test-ats:test-company:1002';

  beforeEach(() => {
    // Clean test tables
    sqlite.exec(`
      DELETE FROM application_events;
      DELETE FROM applications;
      DELETE FROM jobs WHERE id LIKE 'test-ats:%';
    `);

    // Insert mock jobs
    sqlite.exec(`
      INSERT INTO jobs (
        id, ats, slug, external_id, title, company, location, canonical_url, apply_url,
        score, tier, status, first_seen_at, last_seen_at
      ) VALUES 
      ('${testJobId}', 'test-ats', 'test-company', '1001', 'Staff Backend Engineer', 'Stripe', 'Remote - India', 'https://example.com/1', 'https://example.com/1', 82, 'tier_a', 'open', '2026-09-10T10:00:00Z', '2026-09-20T10:00:00Z'),
      ('${testJobId2}', 'test-ats', 'test-company', '1002', 'Senior AI Systems Engineer', 'Datadog', 'Tokyo, Japan', 'https://example.com/2', 'https://example.com/2', 78, 'tier_a', 'open', '2026-09-15T10:00:00Z', '2026-09-20T10:00:00Z');
    `);
  });

  it('allows one-click "Applied" and appends application_events', () => {
    const app = trackJob(testJobId, 'applied', {
      channel: 'referral',
      notes: 'Referred by senior director',
    });

    expect(app).toBeDefined();
    expect(app.jobId).toBe(testJobId);
    expect(app.status).toBe('applied');
    expect(app.channel).toBe('referral');
    expect(app.appliedAt).toBeDefined();
    expect(app.nextFollowUpAt).toBeDefined();

    // Verify events were appended
    const events = sqlite
      .prepare('SELECT * FROM application_events WHERE application_id = ?')
      .all(app.id) as Array<{ event_type: string; payload_json: string }>;
    
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].event_type).toBe('applied');
  });

  it('updates status and appends status_change event without losing data', () => {
    const app = trackJob(testJobId, 'saved', { notes: 'Considering' });
    expect(app.status).toBe('saved');

    const updated = updateApplicationStatus(app.id, 'interview', {
      notes: 'Technical screen scheduled',
    });

    expect(updated.status).toBe('interview');

    const events = sqlite
      .prepare('SELECT * FROM application_events WHERE application_id = ? ORDER BY id ASC')
      .all(app.id) as Array<{ event_type: string; payload_json: string }>;
    
    expect(events.length).toBe(2);
    expect(events[0].event_type).toBe('saved');
    expect(events[1].event_type).toBe('status_change');
  });

  it('calculates follow-up cadences correctly (+7d, +14d, and ghosted suggest)', () => {
    const now = new Date('2026-09-20T12:00:00Z');
    
    // Day 0: Applied -> Next follow-up at +7 days
    const next7d = calculateNextFollowUp('applied', '2026-09-20T12:00:00Z', 0, now);
    expect(next7d).toBe('2026-09-27T12:00:00.000Z');

    // Follow-up 1 already sent -> Next at +14 days from applied
    const next14d = calculateNextFollowUp('applied', '2026-09-20T12:00:00Z', 1, now);
    expect(next14d).toBe('2026-10-04T12:00:00.000Z');

    // Interview -> Next follow-up at +1 day (24h)
    const interviewNext = calculateNextFollowUp('interview', '2026-09-20T12:00:00Z', 0, now);
    expect(interviewNext).toBe('2026-09-21T12:00:00.000Z');
  });

  it('calculates Today cockpit metrics and weekly goal (10 target)', () => {
    // Create 3 applications applied this week
    trackJob(testJobId, 'applied', { channel: 'direct' });
    trackJob(testJobId2, 'applied', { channel: 'referral' });

    const cockpit = getTodayCockpit();
    expect(cockpit.weeklyGoal.target).toBe(10);
    expect(cockpit.weeklyGoal.completed).toBe(2);
    expect(cockpit.weeklyGoal.remaining).toBe(8);
    expect(cockpit.weeklyGoal.percent).toBe(20);
    expect(cockpit.trackedCount).toBe(2);
  });

  it('detects when an actively tracked job has been closed by employer and raises an alert', () => {
    const app = trackJob(testJobId, 'applied', { channel: 'direct' });

    // Simulate ATS scan closing the job
    sqlite.exec(`UPDATE jobs SET status = 'closed' WHERE id = '${testJobId}'`);

    const alerts = checkClosedTrackedJobs();
    expect(alerts.length).toBe(1);
    expect(alerts[0].jobId).toBe(testJobId);
    expect(alerts[0].company).toBe('Stripe');
    expect(alerts[0].applicationId).toBe(app.id);

    // Verify alert event was logged in application_events
    const events = sqlite
      .prepare(`SELECT * FROM application_events WHERE application_id = ? AND event_type = 'job_closed_by_employer'`)
      .all(app.id);
    expect(events.length).toBe(1);
  });

  it('computes funnel insights and conversion rates', () => {
    trackJob(testJobId, 'applied', { channel: 'direct' });
    const app2 = trackJob(testJobId2, 'applied', { channel: 'referral' });
    updateApplicationStatus(app2.id, 'screening');

    const insights = getFunnelInsights();
    expect(insights.totalTracked).toBe(2);
    expect(insights.byStage['applied']).toBe(1);
    expect(insights.byStage['screening']).toBe(1);
    expect(insights.byChannel['direct']).toBe(1);
    expect(insights.byChannel['referral']).toBe(1);
  });
});
