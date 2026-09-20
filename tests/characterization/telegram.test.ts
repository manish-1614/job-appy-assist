import { describe, it, expect } from 'vitest';
import { escapeHtml, formatTelegramDigest } from '@/lib/telegram';
import { EvaluatedJob } from '@/lib/ats-adapters';

describe('Telegram Notification Engine (lib/telegram.ts)', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters safely', () => {
      expect(escapeHtml('C++ & Python <Staff> "Lead"')).toBe(
        'C++ &amp; Python &lt;Staff&gt; &quot;Lead&quot;'
      );
    });

    it('handles empty or undefined strings without crashing', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null as unknown as string)).toBe('');
    });
  });

  describe('formatTelegramDigest', () => {
    it('formats empty digest with HTML tags and escaped scanId', () => {
      const output = formatTelegramDigest({
        scanId: 'scan_<test>&1',
        timestamp: '2026-09-20T12:00:00.000Z',
        freshJobs: [],
        totalSourcesChecked: 14,
        healthySourcesCount: 14,
      });

      expect(output).toContain('<b>JOB DISCOVERY PORTAL - RETRIEVAL REPORT</b>');
      expect(output).toContain('<code>scan_&lt;test&gt;&amp;1</code>');
      expect(output).toContain('<i>Automated 12-hour scanner is active and monitoring direct ATS & RSS feeds.</i>');
    });

    it('formats job list using valid HTML tags and escapes title & company', () => {
      const mockJob: EvaluatedJob = {
        id: 'job-1',
        source: 'greenhouse',
        externalId: 'ext-1',
        title: 'Staff Engineer <AI & Cloud>',
        company: 'Stripe & Partners',
        location: 'Remote - India',
        canonicalUrl: 'https://example.com/apply?id=1&ref=test',
        sourceType: 'ats',
        score: 95,
        matchReason: 'Direct overlap with distributed systems & Kafka.',
        strengths: ['Strong architecture background'],
        concerns: [],
        sponsorship: 'explicit',
        evidenceQuotes: ['Quote 1'],
        techStack: ['Kafka', 'Java'],
        isRemote: true,
        salary: '₹50L - ₹65L',
        status: 'open',
        firstSeenAt: '2026-09-20T00:00:00.000Z',
        lastSeenAt: '2026-09-20T12:00:00.000Z',
      };

      const output = formatTelegramDigest({
        scanId: 'scan-101',
        timestamp: '2026-09-20T12:00:00.000Z',
        freshJobs: [mockJob],
        totalSourcesChecked: 10,
        healthySourcesCount: 10,
      });

      expect(output).toContain('<b>Staff Engineer &lt;AI &amp; Cloud&gt;</b>');
      expect(output).toContain('<b>Company:</b> Stripe &amp; Partners');
      expect(output).toContain('<code>95/100</code>');
      expect(output).toContain('<a href="https://example.com/apply?id=1&amp;ref=test">Apply Directly</a>');
    });
  });
});
