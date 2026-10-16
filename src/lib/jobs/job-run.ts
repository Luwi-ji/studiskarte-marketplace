import { sql } from "drizzle-orm";
import { jobRun } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Every scheduled job, and how long it may go without finishing before the
 * scheduler is considered stopped. Each job is safe to run twice.
 */
export const JOBS = {
  // Runs every 15 minutes (GitHub Actions) and daily (Vercel cron).
  "expire-posts": { maxAgeMinutes: 3 * 60 },
  // Runs daily (Vercel cron).
  cleanup: { maxAgeMinutes: 36 * 60 },
} as const;

export type JobName = keyof typeof JOBS;

export function isJobName(value: string): value is JobName {
  return Object.hasOwn(JOBS, value);
}

/** Runs a job and records when it started, finished and how it went. */
export async function runJob(name: JobName, job: () => Promise<string>): Promise<string> {
  const db = getDb();
  const startedAt = new Date();
  await db
    .insert(jobRun)
    .values({ name, lastStartedAt: startedAt, lastStatus: "running" })
    .onConflictDoUpdate({
      target: jobRun.name,
      set: { lastStartedAt: startedAt, lastStatus: "running", lastDetail: null },
    });
  try {
    const detail = await job();
    await db
      .update(jobRun)
      .set({ lastFinishedAt: new Date(), lastStatus: "ok", lastDetail: detail })
      .where(sql`${jobRun.name} = ${name}`);
    return detail;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await db
      .update(jobRun)
      .set({ lastFinishedAt: new Date(), lastStatus: "failed", lastDetail: detail.slice(0, 500) })
      .where(sql`${jobRun.name} = ${name}`);
    throw error;
  }
}

export type StaleJob = { name: JobName; reason: "never_ran" | "too_old" | "last_failed"; lastFinishedAt: Date | null };

/** Jobs that have not finished successfully recently enough. Empty means the scheduler is healthy. */
export async function staleJobs(now = new Date()): Promise<StaleJob[]> {
  const rows = await getDb().select().from(jobRun);
  const byName = new Map(rows.map((row) => [row.name, row]));
  const stale: StaleJob[] = [];
  for (const name of Object.keys(JOBS).filter(isJobName)) {
    const row = byName.get(name);
    if (!row) {
      stale.push({ name, reason: "never_ran", lastFinishedAt: null });
      continue;
    }
    if (row.lastStatus === "failed") {
      stale.push({ name, reason: "last_failed", lastFinishedAt: row.lastFinishedAt });
      continue;
    }
    const age = now.getTime() - (row.lastFinishedAt ?? row.lastStartedAt).getTime();
    if (row.lastFinishedAt === null || age > JOBS[name].maxAgeMinutes * 60_000) {
      stale.push({ name, reason: "too_old", lastFinishedAt: row.lastFinishedAt });
    }
  }
  return stale;
}
