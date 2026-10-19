import { GET as runJobs } from "@/app/api/jobs/run/route";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { rateLimitEvent } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import {
  countEmailsSentLast24h,
  healthWarnings,
  measureHealth,
  NEON_FREE_TIER_BYTES,
  R2_FREE_TIER_BYTES,
  WARN_AT_PERCENT,
  type HealthMeasurements,
} from "@/lib/jobs/health";
import { MAIL_DAILY_LIMIT, MAIL_QUOTA_ACTION, MAIL_QUOTA_KEY, MAIL_QUOTA_STOP_AT } from "@/lib/rate-limit";

const quiet: HealthMeasurements = { emailsSent24h: 0, r2Bytes: 0, databaseBytes: 0 };
const share = (limit: number) => (limit * WARN_AT_PERCENT) / 100;

describe("healthWarnings", () => {
  it("is silent when nothing is near a limit", () => {
    expect(healthWarnings(quiet)).toEqual([]);
  });

  it("warns about mail at 80% of the daily limit and not below", () => {
    const at = share(MAIL_DAILY_LIMIT);
    expect(healthWarnings({ ...quiet, emailsSent24h: at - 1 })).toEqual([]);
    expect(healthWarnings({ ...quiet, emailsSent24h: at })).toEqual([
      `Mail quota: ${at} of ${MAIL_DAILY_LIMIT} emails sent in the last 24 hours (80%). Sending stops at ${MAIL_QUOTA_STOP_AT}.`,
    ]);
  });

  it("warns about photo storage at 80% of 10 GB and not below", () => {
    const at = share(R2_FREE_TIER_BYTES);
    expect(healthWarnings({ ...quiet, r2Bytes: at - 1 })).toEqual([]);
    expect(healthWarnings({ ...quiet, r2Bytes: at })).toEqual([
      "Photo storage: 8.00 GB of 10.00 GB used in R2 (80%).",
    ]);
  });

  it("warns about database size at 80% of 0.5 GB and not below", () => {
    const at = share(NEON_FREE_TIER_BYTES);
    expect(healthWarnings({ ...quiet, databaseBytes: at - 1 })).toEqual([]);
    expect(healthWarnings({ ...quiet, databaseBytes: at })).toEqual([
      "Database size: 400 MB of 500 MB used in Neon (80%).",
    ]);
  });

  it("reports every limit that is reached", () => {
    const warnings = healthWarnings({
      emailsSent24h: MAIL_DAILY_LIMIT,
      r2Bytes: R2_FREE_TIER_BYTES,
      databaseBytes: NEON_FREE_TIER_BYTES,
    });
    expect(warnings).toHaveLength(3);
  });
});

describe("measuring", () => {
  const db = getDb();
  const HOUR = 3_600_000;
  let ids: number[] = [];

  afterAll(async () => {
    if (ids.length > 0) await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.id, ids));
    await getPool().end();
  });

  it("counts only the mail sent in the last 24 hours", async () => {
    const before = await countEmailsSentLast24h();
    const now = Date.now();
    const rows = await db
      .insert(rateLimitEvent)
      .values([
        { action: MAIL_QUOTA_ACTION, key: MAIL_QUOTA_KEY, createdAt: new Date(now - 25 * HOUR) },
        { action: MAIL_QUOTA_ACTION, key: MAIL_QUOTA_KEY, createdAt: new Date(now - 23 * HOUR) },
        { action: MAIL_QUOTA_ACTION, key: MAIL_QUOTA_KEY, createdAt: new Date(now - 1 * HOUR) },
        // Other actions and other keys are not mail.
        { action: "otp_request", key: MAIL_QUOTA_KEY, createdAt: new Date(now - 1 * HOUR) },
        { action: MAIL_QUOTA_ACTION, key: "someone", createdAt: new Date(now - 1 * HOUR) },
      ])
      .returning({ id: rateLimitEvent.id });
    ids = rows.map((row) => row.id);

    expect(await countEmailsSentLast24h()).toBe(before + 2);
  });

  it("measures storage and database size from the real database", async () => {
    const m = await measureHealth();
    expect(m.databaseBytes).toBeGreaterThan(0);
    expect(m.r2Bytes).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(m.r2Bytes)).toBe(true);
    expect(m.emailsSent24h).toBeGreaterThanOrEqual(2);
  });

  it("reports warnings from the health job in the endpoint response, and none for other jobs", async () => {
    const secret = "test-secret-0123456789abcdef";
    const saved = process.env.CRON_SECRET;
    process.env.CRON_SECRET = secret;
    try {
      const call = async (job: string) =>
        (await runJobs(new Request(`http://localhost:3000/api/jobs/run?job=${job}`, { headers: { authorization: `Bearer ${secret}` } }))).json();
      const health = await call("health");
      expect(health.results.health).toMatch(/^(no warnings|\d+ warnings)$/);
      expect(Array.isArray(health.warnings)).toBe(true);
      expect(health.stale).toBeInstanceOf(Array);
      expect((await call("expire-posts")).warnings).toEqual([]);
    } finally {
      if (saved === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = saved;
    }
  });
});
