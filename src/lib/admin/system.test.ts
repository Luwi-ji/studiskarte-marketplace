import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { NEON_FREE_TIER_BYTES, R2_FREE_TIER_BYTES } from "@/lib/jobs/health";
import { JOBS } from "@/lib/jobs/job-run";
import { currentLegal } from "@/lib/legal/documents";
import { MAIL_DAILY_LIMIT, MAIL_QUOTA_STOP_AT } from "@/lib/rate-limit";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { getSystemStatus } from "./system";

const db = getDb();
const who = `sy-acc-${randomUUID().slice(0, 6)}`;
const visitors = process.env.ALLOW_VISITORS;

afterEach(() => {
  if (visitors === undefined) delete process.env.ALLOW_VISITORS;
  else process.env.ALLOW_VISITORS = visitors;
});

afterAll(async () => {
  await deleteTestStudent(who);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
}, 60_000);

describe("getSystemStatus", () => {
  it("reports mail, database and storage against their limits", async () => {
    const s = await getSystemStatus();
    expect(s.mail.limit).toBe(MAIL_DAILY_LIMIT);
    expect(s.mailStopAt).toBe(MAIL_QUOTA_STOP_AT);
    expect(s.database.limit).toBe(NEON_FREE_TIER_BYTES);
    expect(s.storage.limit).toBe(R2_FREE_TIER_BYTES);
    for (const usage of [s.mail, s.database, s.storage]) {
      expect(usage.used).toBeGreaterThanOrEqual(0);
      expect(usage.share).toEqual({ numerator: usage.used, denominator: usage.limit, share: usage.used / usage.limit });
      expect(Number.isFinite(usage.share.share)).toBe(true);
    }
    expect(s.database.used).toBeGreaterThan(0);
  });

  it("lists every scheduled job once, in the order of the jobs table", async () => {
    const s = await getSystemStatus();
    expect(s.jobs.map((j) => j.name)).toEqual(Object.keys(JOBS));
    for (const job of s.jobs) expect(job.maxAgeMinutes).toBe(JOBS[job.name].maxAgeMinutes);
  });

  it("calls a job overdue once it has not finished for longer than it may, and never overdue long before", async () => {
    const far = await getSystemStatus(new Date("2100-01-01T00:00:00Z"));
    for (const job of far.jobs) expect(["overdue", "failed", "never_ran"]).toContain(job.state);
    const past = await getSystemStatus(new Date("2000-01-01T00:00:00Z"));
    for (const job of past.jobs) expect(["ok", "running", "failed", "never_ran"]).toContain(job.state);
    // A job that has a record shows when it last started, and a job without one shows nothing.
    for (const job of far.jobs) expect(job.state === "never_ran").toBe(job.lastStartedAt === null);
  });

  it("counts the active accounts that accepted the current legal version", async () => {
    const legal = currentLegal();
    const before = await getSystemStatus();
    expect(before.legal.version).toBe(legal?.version ?? null);
    expect(before.legal.accepted.numerator).toBeLessThanOrEqual(before.legal.accepted.denominator);

    await createTestStudent(who, { handle: `sy_${who.slice(-6)}` });
    const withoutTerms = await getSystemStatus();
    expect(withoutTerms.legal.accepted.denominator - before.legal.accepted.denominator).toBe(1);
    expect(withoutTerms.legal.accepted.numerator).toBe(before.legal.accepted.numerator);

    if (legal) {
      await db.update(student).set({ termsVersion: legal.version, termsAcceptedAt: new Date() }).where(eq(student.id, who));
      const accepted = await getSystemStatus();
      expect(accepted.legal.accepted.numerator - before.legal.accepted.numerator).toBe(1);
      await db.update(student).set({ termsVersion: `${legal.version}-old` }).where(eq(student.id, who));
      expect((await getSystemStatus()).legal.accepted.numerator).toBe(before.legal.accepted.numerator);
    }
  });

  it("says whether visitors may sign up, from ALLOW_VISITORS", async () => {
    process.env.ALLOW_VISITORS = "true";
    expect((await getSystemStatus()).visitorsAllowed).toBe(true);
    process.env.ALLOW_VISITORS = "false";
    expect((await getSystemStatus()).visitorsAllowed).toBe(false);
    delete process.env.ALLOW_VISITORS;
    expect((await getSystemStatus()).visitorsAllowed).toBe(false);
  });
});
