import { describe, it, expect } from 'vitest';
import { parseAtsFromUrl, parseAtsFromHtml } from '../../lib/ats-detector';

describe('ATS Detector', () => {
  it('detects Greenhouse from direct board URL', () => {
    const res = parseAtsFromUrl('https://boards.greenhouse.io/stripe');
    expect(res).toEqual({
      ats: 'greenhouse',
      slug: 'stripe',
      companyName: 'Stripe',
    });
  });

  it('detects Lever from direct postings URL', () => {
    const res = parseAtsFromUrl('https://jobs.lever.co/anthropic');
    expect(res).toEqual({
      ats: 'lever',
      slug: 'anthropic',
      companyName: 'Anthropic',
    });
  });

  it('detects Ashby from direct board URL', () => {
    const res = parseAtsFromUrl('https://jobs.ashbyhq.com/postman');
    expect(res).toEqual({
      ats: 'ashby',
      slug: 'postman',
      companyName: 'Postman',
    });
  });

  it('detects SmartRecruiters from direct jobs URL', () => {
    const res = parseAtsFromUrl('https://jobs.smartrecruiters.com/Square');
    expect(res).toEqual({
      ats: 'smartrecruiters',
      slug: 'Square',
      companyName: 'Square',
    });
  });

  it('detects Workable from direct URL', () => {
    const res = parseAtsFromUrl('https://apply.workable.com/resend');
    expect(res).toEqual({
      ats: 'workable',
      slug: 'resend',
      companyName: 'Resend',
    });
  });

  it('detects Recruitee from subdomain URL', () => {
    const res = parseAtsFromUrl('https://monzo.recruitee.com');
    expect(res).toEqual({
      ats: 'recruitee',
      slug: 'monzo',
      companyName: 'Monzo',
    });
  });

  it('detects Greenhouse embedded in careers page HTML', () => {
    const html = `
      <html>
        <head><title>Careers at Acme Corp</title></head>
        <body>
          <h1>Join our team</h1>
          <iframe src="https://boards.greenhouse.io/embed/job_board?for=acmecorp" width="100%"></iframe>
        </body>
      </html>
    `;
    const res = parseAtsFromHtml(html, 'https://acme.com/careers');
    expect(res).not.toBeNull();
    expect(res?.ats).toBe('greenhouse');
    expect(res?.slug).toBe('acmecorp');
  });

  it('detects Lever embedded in careers page HTML', () => {
    const html = `
      <div>
        <script src="https://andreasnotes.com/test"></script>
        <a href="https://jobs.lever.co/coolstartup/12345">View Engineering Opening</a>
      </div>
    `;
    const res = parseAtsFromHtml(html, 'https://coolstartup.io/jobs');
    expect(res).not.toBeNull();
    expect(res?.ats).toBe('lever');
    expect(res?.slug).toBe('coolstartup');
  });

  it('detects Ashby embedded in careers page HTML', () => {
    const html = `
      <div id="ashby_embed">
        <a href="https://jobs.ashbyhq.com/supabase/engineering">See open roles</a>
      </div>
    `;
    const res = parseAtsFromHtml(html, 'https://supabase.com/careers');
    expect(res).not.toBeNull();
    expect(res?.ats).toBe('ashby');
    expect(res?.slug).toBe('supabase');
  });
});
