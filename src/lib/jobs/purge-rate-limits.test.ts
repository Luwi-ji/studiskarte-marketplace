import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { rateLimitEvent } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { RATE_LIMIT_KEEP_SECONDS, purgeRateLimits } from "@/lib/jobs/purge-rate-limits";
import { MAIL_QUOTA_WINDOW_SECONDS, consume, countEvents } from "@/lib/rate-limit";

const db = getDb();
const key = `purge-${randomUUID().slice(0, 8)}`;
const ago = (seconds: number) => sql`now() - make_interval(secs => ${seconds})`;

afterAll(async () => {
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, key));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("purging rate-limit rows", () => {
  it("deletes only rows older than the longest window, so no limit changes", async () => {
    await db.insert(rateLimitEvent).values([
      { action: "purge_test", key, createdAt: ago(RATE_LIMIT_KEEP_SECONDS + 60) as unknown as Date },
      { action: "purge_test", key, createdAt: ago(RATE_LIMIT_KEEP_SECONDS + 3600) as unknown as Date },
      { action: "purge_test", key, createdAt: ago(MAIL_QUOTA_WINDOW_SECONDS - 60) as unknown as Date },
    ]);
    expect(await consume({ action: "purge_test", key, max: 5, windowSeconds: 60 })).toBe(true);
    const before = await countEvents("purge_test", key, MAIL_QUOTA_WINDOW_SECONDS);

    expect(await purgeRateLimits()).toBeGreaterThanOrEqual(2);

    const left = await db.select({ id: rateLimitEvent.id }).from(rateLimitEvent).where(eq(rateLimitEvent.key, key));
    expect(left).toHaveLength(2);
    expect(await countEvents("purge_test", key, MAIL_QUOTA_WINDOW_SECONDS)).toBe(before);
    expect(await purgeRateLimits()).toBeGreaterThanOrEqual(0);
  });
});
