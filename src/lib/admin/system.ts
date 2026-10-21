import { sql } from "drizzle-orm";
import { jobRun } from "@/db/schema";
import { getDb } from "@/lib/db";
import { visitorsAllowed } from "@/lib/identity/auth";
import { measureHealth, NEON_FREE_TIER_BYTES, R2_FREE_TIER_BYTES } from "@/lib/jobs/health";
import { JOBS, staleJobs, type JobName } from "@/lib/jobs/job-run";
import { currentLegal } from "@/lib/legal/documents";
import { MAIL_DAILY_LIMIT, MAIL_QUOTA_STOP_AT } from "@/lib/rate-limit";
import { ratio, type Ratio } from "./series";

/** How much of a free-tier limit is used. */
export type Usage = { used: number; limit: number; share: Ratio };

/**
 * `ok`: finished well and recently. `running`: started and not yet finished, but the last finish is recent.
 * `overdue`: has not finished for longer than it should. `failed`: the last run failed. `never_ran`: no record.
 */
export type JobState = "ok" | "running" | "overdue" | "failed" | "never_ran";

export type JobLine = {
  name: JobName;
  state: JobState;
  maxAgeMinutes: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  /** The job's own short result or error message. */
  detail: string | null;
};

export type SystemStatus = {
  /** Mail sent in the last 24 hours against the daily limit; sending stops at `mailStopAt`. */
  mail: Usage;
  mailStopAt: number;
  database: Usage;
  /** Photo storage in R2, estimated from the recorded sizes. */
  storage: Usage;
  jobs: JobLine[];
  legal: {
    /** Null until the owner supplies the legal text. */
    version: string | null;
    /** Active accounts that accepted the current version, out of all active accounts. */
    accepted: Ratio;
  };
  visitorsAllowed: boolean;
};

type AcceptedRow = { accepted: number; active: number };

/** Mail, storage, scheduled jobs, the legal version and the sign-up switch: what the owner checks to see the service is healthy. */
export async function getSystemStatus(now: Date = new Date()): Promise<SystemStatus> {
  const db = getDb();
  const version = currentLegal()?.version ?? null;
  const [health, runs, stale, accepted] = await Promise.all([
    measureHealth(),
    db.select().from(jobRun),
    staleJobs(now),
    db.execute<AcceptedRow>(sql`
      select (count(*) filter (where terms_version = ${version}))::int as accepted, count(*)::int as active
        from student where account_status = 'active'
    `),
  ]);

  const runByName = new Map(runs.map((run) => [run.name, run]));
  const staleByName = new Map(stale.map((job) => [job.name, job.reason]));
  const jobs = (Object.keys(JOBS) as JobName[]).map((name): JobLine => {
    const run = runByName.get(name);
    const reason = staleByName.get(name);
    const state: JobState =
      reason === "never_ran" ? "never_ran" : reason === "last_failed" ? "failed" : reason === "too_old" ? "overdue" : run?.lastStatus === "running" ? "running" : "ok";
    return {
      name,
      state,
      maxAgeMinutes: JOBS[name].maxAgeMinutes,
      lastStartedAt: run?.lastStartedAt ?? null,
      lastFinishedAt: run?.lastFinishedAt ?? null,
      detail: run?.lastDetail ?? null,
    };
  });

  const usage = (used: number, limit: number): Usage => ({ used, limit, share: ratio(used, limit) });
  return {
    mail: usage(health.emailsSent24h, MAIL_DAILY_LIMIT),
    mailStopAt: MAIL_QUOTA_STOP_AT,
    database: usage(health.databaseBytes, NEON_FREE_TIER_BYTES),
    storage: usage(health.r2Bytes, R2_FREE_TIER_BYTES),
    jobs,
    legal: { version, accepted: ratio(accepted.rows[0].accepted, accepted.rows[0].active) },
    visitorsAllowed: visitorsAllowed(),
  };
}
