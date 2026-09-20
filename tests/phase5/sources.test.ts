import { describe, it, expect } from 'vitest';
import { loadCompanies } from '../../lib/storage';

describe('Phase 5 Active Sources Acceptance Criteria', () => {
  it('has >= 30 active sources in watchlist', () => {
    const companies = loadCompanies();
    const active = companies.filter(c => c.isActive);

    expect(active.length).toBeGreaterThanOrEqual(30);

    // Verify ATS diversity
    const atsTypes = new Set(active.map(c => c.ats));
    expect(atsTypes.has('greenhouse')).toBe(true);
    expect(atsTypes.has('lever')).toBe(true);
    expect(atsTypes.has('ashby')).toBe(true);
    expect(atsTypes.has('workable')).toBe(true);
    expect(atsTypes.has('recruitee')).toBe(true);
    expect(atsTypes.has('rss')).toBe(true);
  });
});
