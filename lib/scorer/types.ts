import { RoleFamily } from '../ai-evaluator';

export type RemoteScope =
  | 'worldwide'
  | 'apac'
  | 'india'
  | 'region_locked'
  | 'hybrid'
  | 'onsite'
  | 'unknown';

export type EngagementType = 'employee' | 'contractor' | 'eor' | 'unknown';

export type VisaSponsorship = 'explicit' | 'none' | 'unknown';

export type SeniorityLevel =
  | 'junior'
  | 'mid'
  | 'senior'
  | 'staff_principal'
  | 'lead_manager'
  | 'unknown';

export type LocationClass =
  | 'remote_worldwide'
  | 'remote_apac_or_india'
  | 'india_office'
  | 'jp_kr_onsite_sponsored'
  | 'region_locked'
  | 'onsite_elsewhere'
  | 'unknown';

export interface ExtractedSalary {
  min?: number;
  max?: number;
  currency?: string; // 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | etc.
  period?: 'yearly' | 'monthly' | 'hourly';
}

export interface ExtractedJobFacts {
  remoteScope: RemoteScope;
  allowedCountries: string[];
  excludedCountries: string[];
  tzOverlap: string | null;
  engagement: EngagementType;
  salary: ExtractedSalary | null;
  visaSponsorship: VisaSponsorship;
  seniority: SeniorityLevel;
  roleFamily: RoleFamily;
  mustHaveTech: string[];
  niceToHaveTech: string[];
  yearsRequired: number | null;
  domainTags: string[];
  presales: boolean;
  quotes: Record<string, string | null>;
}

export interface GateResult {
  passed: boolean;
  gateReason: string | null;
  locationClass: LocationClass;
  gRole: { passed: boolean; reason?: string };
  gEligibility: { passed: boolean; reason?: string };
  gComp: { passed: boolean; reason?: string };
  gSponsorship: { passed: boolean; reason?: string };
}

export interface SubScores {
  roleFit: number;        // 0.30 weight
  stackOverlap: number;   // 0.20 weight
  reachability: number;   // 0.15 weight
  domainAffinity: number; // 0.10 weight
  freshness: number;      // 0.10 weight
  compFit: number;        // 0.10 weight
  companySignal: number;  // 0.05 weight
  totalScore: number;     // 0 - 100
  tier: 'tier_a' | 'tier_b' | 'tier_c';
}

export interface ScoredJobResult {
  facts: ExtractedJobFacts;
  gate: GateResult;
  subScores: SubScores;
  score: number;
  tier: 'tier_a' | 'tier_b' | 'tier_c';
  strengths: string[];
  concerns: string[];
  evidenceQuotes: string[];
}
