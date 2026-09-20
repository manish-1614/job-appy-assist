/**
 * CLI Tool: Automated Company Onboarding via Careers URL
 * 
 * Usage:
 *   pnpm add-company <careers-url>
 *   e.g. pnpm add-company https://linear.app/careers
 *   e.g. pnpm add-company https://boards.greenhouse.io/gitlab
 */

import { detectAtsFromUrl } from '../lib/ats-detector';
import { addCompany, loadCompanies } from '../lib/storage';
import { db } from '../lib/db';
import { sources } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.log(`
Usage:
  pnpm add-company <careers-url>

Examples:
  pnpm add-company https://boards.greenhouse.io/gitlab
  pnpm add-company https://jobs.lever.co/anthropic
  pnpm add-company https://jobs.ashbyhq.com/postman
  pnpm add-company https://apply.workable.com/resend
  pnpm add-company https://linear.app/careers
`);
    process.exit(1);
  }

  console.log(`🔍 Inspecting careers URL: ${targetUrl}...`);

  const detected = await detectAtsFromUrl(targetUrl);

  if (!detected) {
    console.error(`❌ Could not automatically detect ATS system from ${targetUrl}.`);
    console.error(`Please provide direct ATS board URL (e.g. boards.greenhouse.io/<slug> or jobs.lever.co/<slug>).`);
    process.exit(1);
  }

  console.log(`✅ Detected ATS: [${detected.ats.toUpperCase()}]`);
  console.log(`🏢 Company Name: ${detected.companyName}`);
  console.log(`🔑 Board Slug:   ${detected.slug}`);

  // Check if already in watchlist
  const existing = loadCompanies();
  const alreadyAdded = existing.find(c => c.ats === detected.ats && c.slug.toLowerCase() === detected.slug.toLowerCase());

  if (alreadyAdded) {
    console.log(`ℹ️ Company "${alreadyAdded.name}" is already in your watchlist (Active: ${alreadyAdded.isActive}).`);
    process.exit(0);
  }

  // Add to storage (both SQLite and companies.json)
  const added = addCompany({
    name: detected.companyName,
    ats: detected.ats,
    slug: detected.slug,
    careersUrl: targetUrl,
    priority: 1,
    isActive: true,
  });

  // Verify in SQLite sources
  try {
    const sourceId = `${detected.ats}:${detected.slug}`;
    const row = db.select().from(sources).where(eq(sources.id, sourceId)).get();
    console.log(`💾 Persisted to SQLite sources table (ID: ${sourceId}, Active: ${row?.active ? 'Yes' : 'No'})`);
  } catch (err: any) {
    console.warn(`[Warning] SQLite sync check: ${err.message}`);
  }

  console.log(`\n🎉 Successfully onboarded "${added.name}"! It will be scanned in the next discovery cycle.`);
}

main().catch(err => {
  console.error('Fatal error onboarding company:', err);
  process.exit(1);
});
