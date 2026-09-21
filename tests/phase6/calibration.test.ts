import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { InterviewGraderEngine } from '../../lib/interview/grader';
import { sqlite } from '../../lib/db';

const CALIBRATION_FILE = path.resolve(
  process.cwd(),
  'docs/interview/pack/calibration/system-design-calibration.yaml'
);

describe('Phase 6: Rubric Grader & Calibration Discrimination Suite', () => {
  let grader: InterviewGraderEngine;
  let calibrationData: any;

  beforeEach(() => {
    grader = new InterviewGraderEngine(true); // Deterministic mode for calibration suite
    if (fs.existsSync(CALIBRATION_FILE)) {
      calibrationData = YAML.parse(fs.readFileSync(CALIBRATION_FILE, 'utf8'));
    }
  });

  describe('1. Calibration Sample Discrimination', () => {
    it('demonstrates >= 1.0 point score separation between strong and weak samples', () => {
      const samples = calibrationData?.samples || [];
      const weakSample = samples.find((s: any) => s.level === 'weak');
      const strongSample = samples.find((s: any) => s.level === 'strong');

      expect(weakSample).toBeDefined();
      expect(strongSample).toBeDefined();

      const weakResult = grader.evaluateDeterministic(
        [{ speaker: 'candidate', text: weakSample.transcript_summary }],
        [],
        {
          dimensions: [
            { id: 'traffic_spike_handling', name: 'Traffic-Spike Handling', weight: 0.3 },
            { id: 'decoupling_and_async', name: 'Decoupling & Asynchrony', weight: 0.3 },
            { id: 'capacity_estimates', name: 'Capacity Estimates', weight: 0.4 },
          ],
        }
      );

      const strongResult = grader.evaluateDeterministic(
        [{ speaker: 'candidate', text: strongSample.transcript_summary }],
        [],
        {
          dimensions: [
            { id: 'traffic_spike_handling', name: 'Traffic-Spike Handling', weight: 0.3 },
            { id: 'decoupling_and_async', name: 'Decoupling & Asynchrony', weight: 0.3 },
            { id: 'capacity_estimates', name: 'Capacity Estimates', weight: 0.4 },
          ],
        }
      );

      // Weak sample should be borderline or no-hire (<= 2.2)
      expect(weakResult.overall_score).toBeLessThanOrEqual(2.2);

      // Strong sample should be hire or strong-hire (>= 3.2)
      expect(strongResult.overall_score).toBeGreaterThanOrEqual(3.2);

      // Margin of discrimination >= 1.0 point
      const margin = strongResult.overall_score - weakResult.overall_score;
      expect(margin).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('2. Zero-Fabrication Rule Enforcement', () => {
    it('every dimension score includes verifiable evidence quote or explicit omission note', () => {
      const sampleText = 'We use a Redis Lua script for flash sale inventory and Kafka for async order fulfillment.';
      const result = grader.evaluateDeterministic(
        [{ speaker: 'candidate', text: sampleText }],
        [],
        {
          dimensions: [
            { id: 'traffic_spike_handling', name: 'Traffic-Spike Handling', weight: 0.5 },
            { id: 'decoupling_and_async', name: 'Decoupling & Asynchrony', weight: 0.5 },
          ],
        }
      );

      for (const d of result.dimension_scores) {
        expect(d.evidence_quote).toBeTruthy();
        expect(d.evidence_quote.length).toBeGreaterThan(5);
        expect(d.rationale).toBeTruthy();
      }
    });
  });

  describe('3. Database & Dossier Persistence', () => {
    it('grades session, inserts scores to SQLite, and writes markdown dossier', async () => {
      const testSessionId = `grade_test_${Date.now()}`;
      sqlite
        .prepare(
          `INSERT INTO interview_sessions (
             id, started_at, company_style, round_type, question_id, live_model, status
           ) VALUES (?, '2026-09-21T10:00:00Z', 'google', 'system_design', 'sys_flash_sale', 'gemini-2.5-flash', 'completed')`
        )
        .run(testSessionId);

      sqlite
        .prepare(
          `INSERT INTO interview_turns (session_id, seq, speaker, text, t_offset_ms)
           VALUES (?, 1, 'candidate', 'To handle 50x spikes, we use Redis Lua scripts and Kafka outbox pattern.', 5000)`
        )
        .run(testSessionId);

      const result = await grader.gradeSession({ sessionId: testSessionId });
      expect(result.overall_score).toBeGreaterThanOrEqual(1.0);

      // Verify SQLite records
      const scoreRows = sqlite
        .prepare(`SELECT * FROM interview_scores WHERE session_id = ?`)
        .all(testSessionId);
      expect(scoreRows.length).toBeGreaterThan(0);

      // Verify dossier exists in data/interviews/
      const todayStr = '2026-09-21';
      const expectedDossier = path.join(process.cwd(), 'data/interviews', `${todayStr}-${testSessionId}.md`);
      expect(fs.existsSync(expectedDossier)).toBe(true);

      const dossierContent = fs.readFileSync(expectedDossier, 'utf8');
      expect(dossierContent).toContain(`Mock-Interview Session Dossier: ${testSessionId}`);
      expect(dossierContent).toContain('Rubric Dimension Scores');

      // Clean up test dossier
      try {
        fs.unlinkSync(expectedDossier);
      } catch {}
    });
  });
});
