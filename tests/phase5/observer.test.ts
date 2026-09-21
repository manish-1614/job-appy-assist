import { describe, it, expect, beforeEach } from 'vitest';
import { ObserverPolicyEngine } from '../../lib/interview/policy-engine';
import { InterviewObserverService } from '../../lib/interview/observer';
import { getQuestionById } from '../../lib/interview/prompts';

describe('Phase 5: Observer & Spoken Interjections Suite', () => {
  describe('1. Deterministic Policy Engine', () => {
    let policy: ObserverPolicyEngine;
    const baseStart = 1000000;

    beforeEach(() => {
      policy = new ObserverPolicyEngine(baseStart);
    });

    it('blocks interjections during initial 3-minute opening grace period', () => {
      // 60s in
      const d1 = policy.evaluateInterjection(baseStart + 60 * 1000);
      expect(d1.allow).toBe(false);
      expect(d1.reason).toContain('Inside opening grace period');

      // 179s in
      const d2 = policy.evaluateInterjection(baseStart + 179 * 1000);
      expect(d2.allow).toBe(false);
      expect(d2.reason).toContain('Inside opening grace period');
    });

    it('blocks interjections if candidate is actively speaking or stopped < 4s ago', () => {
      const pastGrace = baseStart + 200 * 1000;

      // Candidate is speaking
      policy.onCandidateSpeechChange(true, pastGrace);
      const d1 = policy.evaluateInterjection(pastGrace);
      expect(d1.allow).toBe(false);
      expect(d1.reason).toContain('currently speaking');

      // Candidate stopped speaking 2s ago
      policy.onCandidateSpeechChange(false, pastGrace + 2000);
      const d2 = policy.evaluateInterjection(pastGrace + 3500); // 1.5s after stop
      expect(d2.allow).toBe(false);
      expect(d2.reason).toContain('insufficient time');
    });

    it('allows interjections when candidate is silent for >= 4s after grace period', () => {
      const pastGrace = baseStart + 200 * 1000;
      policy.onCandidateSpeechChange(false, pastGrace);

      // 5s after candidate stopped speaking
      const d = policy.evaluateInterjection(pastGrace + 5000);
      expect(d.allow).toBe(true);
      expect(d.reason).toContain('All policy guards passed');
    });

    it('enforces 90-second cooldown between interjections', () => {
      const t1 = baseStart + 200 * 1000;
      policy.recordInterjectionTriggered(t1);

      // 30s after first interjection
      const d1 = policy.evaluateInterjection(t1 + 30 * 1000);
      expect(d1.allow).toBe(false);
      expect(d1.reason).toContain('cooldown active');

      // 95s after first interjection (silence is maintained)
      const d2 = policy.evaluateInterjection(t1 + 95 * 1000);
      expect(d2.allow).toBe(true);
    });

    it('enforces maximum 4 interjections frequency cap per session', () => {
      let t = baseStart + 200 * 1000;

      // Trigger 4 interjections spaced out by 100s
      for (let i = 0; i < 4; i++) {
        expect(policy.evaluateInterjection(t).allow).toBe(true);
        policy.recordInterjectionTriggered(t);
        t += 100 * 1000;
      }

      // Attempt 5th interjection
      const d = policy.evaluateInterjection(t);
      expect(d.allow).toBe(false);
      expect(d.reason).toContain('frequency cap reached');
    });
  });

  describe('2. Interview Observer Service', () => {
    const observer = new InterviewObserverService(true); // Mock/deterministic mode

    it('flags drifting and suggests probe when critical pillars are omitted in System Design', async () => {
      const question = getQuestionById('sys_flash_sale')!;
      expect(question).toBeDefined();

      const result = await observer.evaluate({
        sessionId: 'test_obs_1',
        question,
        diagramDigest: 'COMPONENTS:\n- API Gateway\n- Database\nCONNECTIONS:\n- API Gateway -> Database',
        recentTurns: [
          { speaker: 'candidate', text: 'I will put an API gateway in front of the PostgreSQL database.' },
        ],
        elapsedMinutes: 5,
      });

      expect(result.status).toBe('drifting');
      expect(result.missing_topics.length).toBeGreaterThan(0);
      expect(result.suggested_probe).toBeTruthy();
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('marks candidate on_track when critical pillars (spikes, queues, failover) are covered', async () => {
      const question = getQuestionById('sys_flash_sale')!;

      const result = await observer.evaluate({
        sessionId: 'test_obs_2',
        question,
        diagramDigest: 'COMPONENTS:\n- API Gateway\n- Kafka Queue\n- Redis Cluster\n- PostgreSQL Replica',
        recentTurns: [
          {
            speaker: 'candidate',
            text: 'To handle the 50x spike, we use a token bucket rate limit and an asynchronous Kafka queue with outbox pattern for failover.',
          },
        ],
        elapsedMinutes: 10,
      });

      expect(result.status).toBe('on_track');
      expect(result.missing_topics.length).toBe(0);
    });
  });
});
