import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  integer,
  unique,
  index,
} from "drizzle-orm/pg-core";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  ats: text("ats").notNull(), // 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters'
  slug: text("slug").notNull(),
  careersUrl: text("careers_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const jobPostings = pgTable(
  "job_postings",
  {
    id: serial("id").primaryKey(),
    companyId: integer("company_id")
      .notNull()
      .references(() => companies.id),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    location: text("location"),
    applyUrl: text("apply_url").notNull(),
    atsPostedAt: timestamp("ats_posted_at", { withTimezone: true }),
    atsUpdatedAt: timestamp("ats_updated_at", { withTimezone: true }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("open"), // 'open' | 'closed'
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => ({
    companyExternalUnique: unique("company_external_unique").on(
      table.companyId,
      table.externalId
    ),
    statusIdx: index("status_idx").on(table.status),
  })
);

export const checkRuns = pgTable("check_runs", {
  id: serial("id").primaryKey(),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
  companiesChecked: integer("companies_checked").notNull(),
  newPostingsFound: integer("new_postings_found").notNull(),
  closedPostingsFound: integer("closed_postings_found").notNull(),
  errors: text("errors"),
});
