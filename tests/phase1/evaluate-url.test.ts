import { describe, it, expect } from 'vitest';
import { SIDEBAR_NAV_ITEMS } from '@/components/navigation/sidebar-config';
import { POST } from '@/app/api/eval/url/route';
import { NextRequest } from 'next/server';

describe('Phase 1 — Dedicated URL Evaluator & Navigation', () => {
  describe('Sidebar Navigation Configuration', () => {
    it('contains the "Evaluate Any Job Opening URL" menu item with exact label', () => {
      const evaluateItem = SIDEBAR_NAV_ITEMS.find((item) => item.id === 'evaluate');
      expect(evaluateItem).toBeDefined();
      expect(evaluateItem?.label).toBe('Evaluate Any Job Opening URL');
      expect(evaluateItem?.shortLabel).toBe('Evaluate URL');
      expect(evaluateItem?.href).toBe('/evaluate');
    });

    it('ensures all sidebar items have valid icons and active classes', () => {
      expect(SIDEBAR_NAV_ITEMS.length).toBeGreaterThanOrEqual(10);
      for (const item of SIDEBAR_NAV_ITEMS) {
        expect(item.id).toBeTruthy();
        expect(item.label).toBeTruthy();
        expect(item.icon).toBeDefined();
        expect(item.activeClass).toBeTruthy();
        // Item must have either href (route) or tab (dashboard view)
        expect(item.href || item.tab).toBeTruthy();
      }
    });
  });

  describe('URL Validation & API Contract (/api/eval/url)', () => {
    it('rejects missing or empty URL with 400 status', async () => {
      const req = new NextRequest('http://127.0.0.1:3000/api/eval/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: '' }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('valid URL is required');
    });

    it('rejects invalid protocol (e.g. ftp:// or javascript:) with 400 status', async () => {
      const req = new NextRequest('http://127.0.0.1:3000/api/eval/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'ftp://example.com/job/123' }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid URL format');
    });

    it('rejects malformed URLs with 400 status', async () => {
      const req = new NextRequest('http://127.0.0.1:3000/api/eval/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });
});
