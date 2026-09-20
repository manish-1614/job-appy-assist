import { ExtractedJobFacts, GateResult, LocationClass } from './types';
import { passesDeterministicGate, classifyRoleFamily } from '../ai-evaluator';

// Exchange rates to INR for compensation floor checking (D1)
export const FX_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 84.0,
  EUR: 92.0,
  GBP: 110.0,
  CAD: 62.0,
  AUD: 55.0,
  SGD: 63.0,
  JPY: 0.56,
  CHF: 95.0,
};

// Hard comp floor per Decision D1 (25 Lakhs INR)
export const HARD_COMP_FLOOR_INR = 25_00_000;

// Accepted India office cities per Decision D3
export const ACCEPTED_INDIA_CITIES = [
  'ranchi',
  'hyderabad',
  'pune',
  'gurgaon',
  'gurugram',
  'noida',
  'new delhi',
  'delhi',
  'bengaluru',
  'bangalore',
  'mumbai',
];

/**
 * Classifies location into standardized LocationClass (D2, D3)
 */
export function classifyLocation(
  rawLocation: string | null | undefined,
  facts: ExtractedJobFacts
): LocationClass {
  const loc = (rawLocation || '').toLowerCase().trim();
  const allowed = (facts.allowedCountries || []).map((c) => c.toLowerCase());
  const remoteScope = facts.remoteScope;

  // 1. Japan / South Korea (Tokyo / Seoul) Track (D8)
  const isJpKr = /\b(japan|tokyo|seoul|south\s+korea|korea)\b/i.test(loc);
  if (isJpKr) {
    if (facts.visaSponsorship === 'explicit') {
      return 'jp_kr_onsite_sponsored';
    }
    // If not explicit sponsorship, onsite in JP/KR cannot be sponsored
    return 'onsite_elsewhere';
  }

  // 2. India Office (D3: Ranchi, Hyderabad, Pune, Gurgaon/Noida, Delhi, Bengaluru, Mumbai)
  const isIndiaCity = ACCEPTED_INDIA_CITIES.some((city) =>
    new RegExp(`\\b${city}\\b`, 'i').test(loc)
  );
  const isIndiaExplicit = /\b(india|in)\b/i.test(loc);
  const isRemoteLocation = /\b(remote|worldwide|anywhere|virtual)\b/i.test(loc);

  if ((isIndiaCity || isIndiaExplicit) && !isRemoteLocation) {
    return 'india_office';
  }

  // 3. Remote Classification
  if (remoteScope === 'worldwide' || /\b(worldwide|anywhere|global|work\s+from\s+anywhere)\b/i.test(loc)) {
    // Check if countries are explicitly locked
    if (allowed.length > 0) {
      const allowsIndia = allowed.some((c) =>
        ['india', 'in', 'worldwide', 'global', 'apac', 'anywhere'].includes(c)
      );
      if (!allowsIndia) {
        return 'region_locked';
      }
    }
    return 'remote_worldwide';
  }

  if (
    remoteScope === 'apac' ||
    remoteScope === 'india' ||
    ((isIndiaCity || isIndiaExplicit) && isRemoteLocation) ||
    /\b(apac|asia-pacific|india)\b/i.test(loc)
  ) {
    return 'remote_apac_or_india';
  }

  // Region-locked Remote (US-only, EMEA-only, Americas-only, etc.)
  if (
    remoteScope === 'region_locked' ||
    (/\b(remote)\b/i.test(loc) &&
      /\b(us|usa|united\s+states|americas|north\s+america|emea|europe|uk|canada|latam)\b/i.test(loc) &&
      !isIndiaCity &&
      !isIndiaExplicit)
  ) {
    return 'region_locked';
  }

  // On-site in other locations (e.g., Chicago, Seattle, London, Berlin, Singapore)
  const foreignCityPatterns = [
    /\b(united\s+states|usa?|san\s+francisco|seattle|new\s+york|chicago|boston|austin|los\s+angeles)\b/i,
    /\b(london|berlin|paris|amsterdam|dublin|toronto|vancouver|sydney|melbourne|singapore)\b/i,
  ];
  if (foreignCityPatterns.some((pat) => pat.test(loc)) && !isRemoteLocation) {
    return 'onsite_elsewhere';
  }

  if (loc === '' || loc === 'unknown' || remoteScope === 'unknown') {
    return 'unknown';
  }

  return 'unknown';
}

/**
 * Checks whether timezone overlap is hostile to IST working hours (D5).
 * Hostile: requires mandatory core overlap during IST 00:00–05:00 daily.
 */
export function isIstHostileTimezone(tzOverlap: string | null | undefined): boolean {
  if (!tzOverlap) return false;
  const tz = tzOverlap.toLowerCase();

  // Explicit midnight / graveyard hours for IST
  if (
    /\b(00:00|01:00|02:00|03:00|04:00|05:00)\s*(ist|india)\b/i.test(tz) ||
    /\b(night\s+shift|graveyard\s+shift)\b/i.test(tz)
  ) {
    return true;
  }

  // Mandatory 8-hour Pacific business hours (PST 9am-5pm is IST 10:30pm to 6:30am)
  if (
    /\b(mandatory|strict)\b/i.test(tz) &&
    /\b(pst|pdt|pacific)\b/i.test(tz) &&
    /\b(9\s*(am)?\s*(to|-)\s*5\s*(pm)?|full\s+overlap)\b/i.test(tz)
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether stated salary violates hard floor (INR 25L) per D1.
 * Returns true if salary is stated and its maximum is below the floor.
 */
export function violatesCompFloor(
  salary: ExtractedJobFacts['salary']
): boolean {
  if (!salary || salary.max === undefined || salary.max === null || salary.max <= 0) {
    return false; // unstated passes gate (neutral)
  }

  const currency = (salary.currency || 'USD').toUpperCase();
  const rate = FX_TO_INR[currency] || 84.0;

  let annualMax = salary.max;
  if (salary.period === 'hourly') {
    annualMax = salary.max * 2000;
  } else if (salary.period === 'monthly') {
    annualMax = salary.max * 12;
  }

  const annualInr = annualMax * rate;
  return annualInr < HARD_COMP_FLOOR_INR;
}

/**
 * Deterministic Gates Evaluator (G-role, G-eligibility, G-comp, G-sponsorship)
 */
export function evaluateGates(
  facts: ExtractedJobFacts,
  job: { title: string; location: string; company: string }
): GateResult {
  // --- Gate 1: G-role ---
  const titlePasses = passesDeterministicGate({
    externalId: 'check',
    title: job.title,
    location: job.location,
    company: job.company,
    applyUrl: '',
    source: 'ats',
  });

  const roleClass = classifyRoleFamily(job.title);
  const isAllowedFamily = ['backend_distributed', 'ai_agentic', 'architect', 'fullstack_backend'].includes(
    facts.roleFamily || roleClass.family
  );

  let gRolePassed = titlePasses && isAllowedFamily;
  let gRoleReason: string | undefined;

  if (!titlePasses) {
    gRolePassed = false;
    gRoleReason = 'gated:role_title_seniority';
  } else if (!isAllowedFamily) {
    gRolePassed = false;
    gRoleReason = `gated:role_family_${facts.roleFamily || roleClass.family}`;
  }

  // --- Gate 2: G-eligibility ---
  const locationClass = classifyLocation(job.location, facts);
  let gEligibilityPassed = true;
  let gEligibilityReason: string | undefined;

  if (locationClass === 'region_locked') {
    gEligibilityPassed = false;
    gEligibilityReason = 'gated:region_locked';
  } else if (locationClass === 'onsite_elsewhere') {
    gEligibilityPassed = false;
    gEligibilityReason = 'gated:onsite_elsewhere';
  } else if (isIstHostileTimezone(facts.tzOverlap)) {
    gEligibilityPassed = false;
    gEligibilityReason = 'gated:ist_hostile_tz';
  } else if (locationClass === 'unknown') {
    // Unknown location is quarantined (status: needs_check), never Tier A
    gEligibilityReason = 'quarantined:unknown_location';
  }

  // --- Gate 3: G-comp ---
  let gCompPassed = true;
  let gCompReason: string | undefined;
  if (violatesCompFloor(facts.salary)) {
    gCompPassed = false;
    gCompReason = 'gated:comp_floor';
  }

  // --- Gate 4: G-sponsorship ---
  let gSponsorshipPassed = true;
  let gSponsorshipReason: string | undefined;
  const isJpKr = /\b(japan|tokyo|seoul|south\s+korea|korea)\b/i.test(job.location);
  if (isJpKr && facts.visaSponsorship !== 'explicit') {
    gSponsorshipPassed = false;
    gSponsorshipReason = 'gated:sponsorship_missing';
  }

  const passed = gRolePassed && gEligibilityPassed && gCompPassed && gSponsorshipPassed && locationClass !== 'unknown';
  const primaryGateReason =
    gRoleReason || (isJpKr && gSponsorshipReason ? gSponsorshipReason : gEligibilityReason) || gCompReason || gSponsorshipReason || null;

  return {
    passed,
    gateReason: primaryGateReason,
    locationClass,
    gRole: { passed: gRolePassed, reason: gRoleReason },
    gEligibility: { passed: gEligibilityPassed, reason: gEligibilityReason },
    gComp: { passed: gCompPassed, reason: gCompReason },
    gSponsorship: { passed: gSponsorshipPassed, reason: gSponsorshipReason },
  };
}
