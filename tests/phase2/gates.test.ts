import { describe, it, expect } from 'vitest';
import {
  classifyLocation,
  evaluateGates,
  violatesCompFloor,
  isIstHostileTimezone,
} from '@/lib/scorer/gates';
import { ExtractedJobFacts } from '@/lib/scorer/types';

function createDefaultFacts(overrides: Partial<ExtractedJobFacts> = {}): ExtractedJobFacts {
  return {
    remoteScope: 'worldwide',
    allowedCountries: [],
    excludedCountries: [],
    tzOverlap: null,
    engagement: 'employee',
    salary: null,
    visaSponsorship: 'unknown',
    seniority: 'senior',
    roleFamily: 'backend_distributed',
    mustHaveTech: ['Java', 'Kafka'],
    niceToHaveTech: [],
    yearsRequired: 8,
    domainTags: ['Distributed Systems'],
    presales: false,
    quotes: {},
    ...overrides,
  };
}

describe('Deterministic Gates (Phase 2)', () => {
  describe('Location Classification & G-eligibility', () => {
    it('classifies remote worldwide locations correctly', () => {
      const facts = createDefaultFacts({ remoteScope: 'worldwide' });
      expect(classifyLocation('Worldwide Remote', facts)).toBe('remote_worldwide');
      expect(classifyLocation('Anywhere in the World', facts)).toBe('remote_worldwide');
    });

    it('classifies India and APAC remote locations correctly', () => {
      const facts = createDefaultFacts({ remoteScope: 'apac' });
      expect(classifyLocation('Remote - India', facts)).toBe('remote_apac_or_india');
      expect(classifyLocation('APAC Remote (Singapore / India / Sydney)', facts)).toBe('remote_apac_or_india');
    });

    it('classifies approved India office locations correctly (D3)', () => {
      const facts = createDefaultFacts({ remoteScope: 'onsite' });
      expect(classifyLocation('Bengaluru, Karnataka, India', facts)).toBe('india_office');
      expect(classifyLocation('Hyderabad, India', facts)).toBe('india_office');
      expect(classifyLocation('Pune, India', facts)).toBe('india_office');
      expect(classifyLocation('Gurugram, Haryana', facts)).toBe('india_office');
    });

    it('gates region-locked remote roles (e.g. US Only, EMEA Only)', () => {
      const facts = createDefaultFacts({
        remoteScope: 'region_locked',
        allowedCountries: ['United States'],
      });
      const gate = evaluateGates(facts, {
        title: 'Senior Backend Engineer',
        location: 'Remote - US Only',
        company: 'Datadog',
      });
      expect(gate.passed).toBe(false);
      expect(gate.gateReason).toBe('gated:region_locked');
    });

    it('gates on-site foreign jobs (F8 finding: Chicago, Seattle, etc.)', () => {
      const facts = createDefaultFacts({ remoteScope: 'onsite' });
      const gate = evaluateGates(facts, {
        title: 'Senior Staff Software Engineer',
        location: 'Chicago, IL, United States',
        company: 'Stripe',
      });
      expect(gate.passed).toBe(false);
      expect(gate.gateReason).toBe('gated:onsite_elsewhere');
    });

    it('gates IST-hostile daily timezone overlap (D5)', () => {
      expect(isIstHostileTimezone('Mandatory PST 9am-5pm schedule full overlap')).toBe(true);
      expect(isIstHostileTimezone('Core overlap between 01:00 to 05:00 IST')).toBe(true);
      expect(isIstHostileTimezone('Requires 3-4 hours overlap with US East')).toBe(false);

      const facts = createDefaultFacts({
        remoteScope: 'worldwide',
        tzOverlap: 'Mandatory PST 9am-5pm schedule full overlap',
      });
      const gate = evaluateGates(facts, {
        title: 'Distributed Systems Engineer',
        location: 'Remote Worldwide',
        company: 'Acme',
      });
      expect(gate.passed).toBe(false);
      expect(gate.gateReason).toBe('gated:ist_hostile_tz');
    });
  });

  describe('G-role & Seniority Gating', () => {
    it('gates junior and entry-level positions', () => {
      const facts = createDefaultFacts({ seniority: 'junior' });
      const gate = evaluateGates(facts, {
        title: 'Junior Software Engineer',
        location: 'Remote - India',
        company: 'Acme',
      });
      expect(gate.passed).toBe(false);
      expect(gate.gateReason).toBe('gated:role_title_seniority');
    });

    it('allows "Internal Tools" and "International" engineering titles (F2)', () => {
      const facts = createDefaultFacts({ roleFamily: 'backend_distributed' });
      const gate = evaluateGates(facts, {
        title: 'Senior Software Engineer, Internal Tools',
        location: 'Remote Worldwide',
        company: 'Stripe',
      });
      expect(gate.gRole.passed).toBe(true);
    });

    it('gates excluded role families (frontend-only, mobile-only, pure data science research)', () => {
      const factsFrontend = createDefaultFacts({ roleFamily: 'frontend_only' });
      const gateFrontend = evaluateGates(factsFrontend, {
        title: 'Staff Frontend Developer (React/CSS)',
        location: 'Remote Worldwide',
        company: 'Acme',
      });
      expect(gateFrontend.passed).toBe(false);

      const factsMobile = createDefaultFacts({ roleFamily: 'mobile_only' });
      const gateMobile = evaluateGates(factsMobile, {
        title: 'Lead iOS Engineer',
        location: 'Remote - India',
        company: 'Acme',
      });
      expect(gateMobile.passed).toBe(false);
    });

    it('allows presales solutions architect through G-role (flagged only per D6)', () => {
      const facts = createDefaultFacts({
        roleFamily: 'architect',
        presales: true,
      });
      const gate = evaluateGates(facts, {
        title: 'Solutions Architect - Pre-sales',
        location: 'Remote - India',
        company: 'AWS',
      });
      expect(gate.gRole.passed).toBe(true);
    });
  });

  describe('G-comp (D1: Hard floor INR 25L)', () => {
    it('gates roles with stated max below 25 Lakhs INR', () => {
      // $20,000 USD * 84 = 16.8 Lakhs INR < 25L
      const lowSalary = { min: 15000, max: 20000, currency: 'USD', period: 'yearly' as const };
      expect(violatesCompFloor(lowSalary)).toBe(true);

      const facts = createDefaultFacts({ salary: lowSalary });
      const gate = evaluateGates(facts, {
        title: 'Senior Backend Engineer',
        location: 'Remote - India',
        company: 'Acme',
      });
      expect(gate.passed).toBe(false);
      expect(gate.gateReason).toBe('gated:comp_floor');
    });

    it('passes roles with stated max at or above 25 Lakhs INR', () => {
      // $120,000 USD * 84 = ~1.00 Crore INR >= 25L
      const goodSalary = { min: 100000, max: 120000, currency: 'USD', period: 'yearly' as const };
      expect(violatesCompFloor(goodSalary)).toBe(false);

      const facts = createDefaultFacts({ salary: goodSalary });
      const gate = evaluateGates(facts, {
        title: 'Senior Backend Engineer',
        location: 'Remote - India',
        company: 'Acme',
      });
      expect(gate.gComp.passed).toBe(true);
    });

    it('passes roles with unstated salary as neutral', () => {
      expect(violatesCompFloor(null)).toBe(false);
      const facts = createDefaultFacts({ salary: null });
      const gate = evaluateGates(facts, {
        title: 'Senior Backend Engineer',
        location: 'Remote - India',
        company: 'Acme',
      });
      expect(gate.gComp.passed).toBe(true);
    });
  });

  describe('G-sponsorship (D8: Japan/Korea track)', () => {
    it('passes Tokyo role when explicit visa sponsorship is confirmed', () => {
      const facts = createDefaultFacts({
        visaSponsorship: 'explicit',
        remoteScope: 'onsite',
      });
      const gate = evaluateGates(facts, {
        title: 'Senior Distributed Systems Engineer',
        location: 'Tokyo, Japan',
        company: 'Rakuten',
      });
      expect(gate.locationClass).toBe('jp_kr_onsite_sponsored');
      expect(gate.gSponsorship.passed).toBe(true);
      expect(gate.passed).toBe(true);
    });

    it('gates Tokyo role when visa sponsorship is not explicit', () => {
      const facts = createDefaultFacts({
        visaSponsorship: 'unknown',
        remoteScope: 'onsite',
      });
      const gate = evaluateGates(facts, {
        title: 'Senior Distributed Systems Engineer',
        location: 'Tokyo, Japan',
        company: 'Mercari',
      });
      expect(gate.passed).toBe(false);
      expect(gate.gateReason).toBe('gated:sponsorship_missing');
    });
  });
});
