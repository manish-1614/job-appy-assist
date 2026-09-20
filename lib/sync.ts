import { and, eq, notInArray, type InferSelectModel } from "drizzle-orm";
import { db } from "./db-neon";
import { companies, jobPostings, checkRuns } from "./schema";
import { fetchCompanyJobs, type AtsType, type JobPosting } from "./ats-adapters";

type CompanyRow = InferSelectModel<typeof companies>;

export type SyncResult = {
  company: string;
  newPostings: JobPosting[];
  closedCount: number;
  error?: string;
};

export async function syncCompany(company: CompanyRow): Promise<SyncResult> {
  let fetched: JobPosting[];
  try {
    fetched = await fetchCompanyJobs(company.name, company.ats as AtsType, company.slug);
  } catch (err) {
    return {
      company: company.name,
      newPostings: [],
      closedCount: 0,
      error: (err as Error).message,
    };
  }

  const now = new Date();
  const newPostings: JobPosting[] = [];

  for (const job of fetched) {
    const existing = await db.query.jobPostings.findFirst({
      where: and(
        eq(jobPostings.companyId, company.id),
        eq(jobPostings.externalId, job.externalId)
      ),
    });

    if (!existing) {
      newPostings.push(job);
      await db.insert(jobPostings).values({
        companyId: company.id,
        externalId: job.externalId,
        title: job.title,
        location: job.location,
        applyUrl: job.applyUrl,
        atsPostedAt: job.postedAt ? new Date(job.postedAt) : null,
        atsUpdatedAt: job.updatedAt ? new Date(job.updatedAt) : null,
        firstSeenAt: now,
        lastSeenAt: now,
        status: "open",
      });
    } else {
      await db
        .update(jobPostings)
        .set({
          lastSeenAt: now,
          atsUpdatedAt: job.updatedAt ? new Date(job.updatedAt) : existing.atsUpdatedAt,
          status: "open",
          closedAt: null,
        })
        .where(eq(jobPostings.id, existing.id));
    }
  }

  const seenExternalIds = fetched.map((j) => j.externalId);
  const closedRows = await db
    .update(jobPostings)
    .set({ status: "closed", closedAt: now })
    .where(
      and(
        eq(jobPostings.companyId, company.id),
        eq(jobPostings.status, "open"),
        seenExternalIds.length > 0
          ? notInArray(jobPostings.externalId, seenExternalIds)
          : undefined
      )
    )
    .returning({ id: jobPostings.id });

  return { company: company.name, newPostings, closedCount: closedRows.length };
}

export async function syncAll(): Promise<{
  results: SyncResult[];
  totalNew: number;
  totalClosed: number;
}> {
  const activeCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.isActive, true));

  const results: SyncResult[] = [];
  for (const company of activeCompanies) {
    results.push(await syncCompany(company));
    await new Promise((r) => setTimeout(r, 500));
  }

  const totalNew = results.reduce((sum, r) => sum + r.newPostings.length, 0);
  const totalClosed = results.reduce((sum, r) => sum + r.closedCount, 0);
  const errors = results.filter((r) => r.error).map((r) => ({ company: r.company, message: r.error }));

  await db.insert(checkRuns).values({
    companiesChecked: activeCompanies.length,
    newPostingsFound: totalNew,
    closedPostingsFound: totalClosed,
    errors: errors.length > 0 ? JSON.stringify(errors) : null,
  });

  return { results, totalNew, totalClosed };
}
