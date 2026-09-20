import { sqlite } from './db';

export type JobLabelType = 'up' | 'down';

export type LabelReasonCode =
  | 'good_match'
  | 'bad_stack'
  | 'not_remote'
  | 'bad_location'
  | 'overqualified'
  | 'underqualified'
  | 'low_comp'
  | 'presales_heavy'
  | 'other';

export interface JobLabel {
  jobId: string;
  label: JobLabelType;
  reasonCode: LabelReasonCode;
  notes?: string | null;
  labeledAt: string;
}

export function saveJobLabel(label: JobLabel): void {
  sqlite.prepare(`
    INSERT OR REPLACE INTO job_labels (
      job_id, label, reason_code, notes, labeled_at
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    label.jobId,
    label.label,
    label.reasonCode,
    label.notes || null,
    label.labeledAt || new Date().toISOString()
  );
}

export function getJobLabel(jobId: string): JobLabel | null {
  const row = sqlite.prepare('SELECT * FROM job_labels WHERE job_id = ?').get(jobId) as any;
  if (!row) return null;
  return {
    jobId: row.job_id,
    label: row.label as JobLabelType,
    reasonCode: row.reason_code as LabelReasonCode,
    notes: row.notes,
    labeledAt: row.labeled_at,
  };
}

export function getAllJobLabels(): JobLabel[] {
  const rows = sqlite.prepare('SELECT * FROM job_labels ORDER BY labeled_at DESC').all() as any[];
  return rows.map((r) => ({
    jobId: r.job_id,
    label: r.label as JobLabelType,
    reasonCode: r.reason_code as LabelReasonCode,
    notes: r.notes,
    labeledAt: r.labeled_at,
  }));
}

export function getLabelStats() {
  const all = getAllJobLabels();
  const upCount = all.filter((l) => l.label === 'up').length;
  const downCount = all.filter((l) => l.label === 'down').length;

  const reasonCounts: Record<string, number> = {};
  for (const l of all) {
    reasonCounts[l.reasonCode] = (reasonCounts[l.reasonCode] || 0) + 1;
  }

  return {
    total: all.length,
    upCount,
    downCount,
    reasonCounts,
  };
}
