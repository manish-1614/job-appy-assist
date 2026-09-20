import { describe, it, expect, beforeEach } from 'vitest';
import { sqlite } from '../../lib/db';
import { tailorApplicationKit, loadAchievements } from '../../lib/kit/tailor';
import { generateResumeDocx, generatePrintableHtml } from '../../lib/kit/export';

describe('Phase 4: Tailoring Engine & Document Export', () => {
  const testJobId = 'test-ats:stripe:9901';

  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM jobs WHERE id = '${testJobId}';
      DELETE FROM job_extractions WHERE job_id = '${testJobId}';
    `);

    sqlite.exec(`
      INSERT INTO jobs (
        id, ats, slug, external_id, title, company, location, canonical_url, apply_url,
        score, tier, status, first_seen_at, last_seen_at, tech_stack_json
      ) VALUES (
        '${testJobId}', 'test-ats', 'stripe', '9901',
        'Staff Backend Engineer - Streaming & Kafka', 'Stripe', 'Remote - India',
        'https://example.com/apply', 'https://example.com/apply',
        85, 'tier_a', 'open', '2026-09-20T10:00:00Z', '2026-09-20T10:00:00Z',
        '["Java", "Kafka", "Distributed Systems", "Kubernetes", "Rust"]'
      );
    `);
  });

  it('tailors application kit with transparent skill gaps and bullet ranking', () => {
    const kit = tailorApplicationKit(testJobId);

    expect(kit).toBeDefined();
    expect(kit.jobId).toBe(testJobId);
    expect(kit.tailoredResume).toBeDefined();
    expect(kit.coverLetter).toBeDefined();

    // Check coverage
    expect(kit.coverage.coveredSkills).toContain('Java');
    expect(kit.coverage.coveredSkills).toContain('Kafka');
    expect(kit.coverage.gapList).toContain('Rust');

    // Check cover letter word count (100 - 300 words)
    expect(kit.coverLetter.wordCount).toBeGreaterThanOrEqual(100);
    expect(kit.coverLetter.body).toContain('Stripe');
    expect(kit.coverLetter.body).toContain('Staff Backend Engineer');

    // Bullets must be populated and valid
    const experience = kit.tailoredResume.experience;
    expect(experience.length).toBeGreaterThan(0);
    expect(experience[0].bullets.length).toBeGreaterThan(0);
  });

  it('generates a valid DOCX binary buffer and printable HTML', async () => {
    const kit = tailorApplicationKit(testJobId);
    const candidate = {
      fullName: 'Manish Kumar Prajapati',
      email: 'mkprajapati@zohomail.in',
      phone: '+91 821-013-4128',
      location: 'India',
      portfolioUrl: 'https://manishprajapati.co.in',
      githubUrl: 'https://github.com/manish-1614',
      linkedinUrl: 'https://linkedin.com/in/mkprajapati1614',
    };

    // 1. DOCX buffer
    const docxBuf = await generateResumeDocx(kit.tailoredResume, candidate);
    expect(docxBuf).toBeDefined();
    expect(docxBuf.length).toBeGreaterThan(1000); // Valid docx file is at least several KB

    // 2. Printable HTML
    const html = generatePrintableHtml(kit.tailoredResume, candidate);
    expect(html).toContain('Manish Kumar Prajapati');
    expect(html).toContain('@media print');
    expect(html).toContain('Amdocs');
  });
});
