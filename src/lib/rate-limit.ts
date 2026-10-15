import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { rateLimitEvent } from "@/db/schema";

export type RateLimit = {
  /** What is being limited, e.g. "otp_request". */
  action: string;
  /** Who it is counted against, e.g. an email address or IP. */
  key: string;
  max: number;
  windowSeconds: number;
};

function countSince(action: string, key: string, windowSeconds: number) {
  return and(
    eq(rateLimitEvent.action, action),
    eq(rateLimitEvent.key, key),
    gt(rateLimitEvent.createdAt, sql`now() - make_interval(secs => ${windowSeconds})`),
  );
}

export async function countEvents(
  action: string,
  key: string,
  windowSeconds: number,
): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(rateLimitEvent)
    .where(countSince(action, key, windowSeconds));
  return row.n;
}

/**
 * Records one attempt, then reports whether it fits the limit. Recording
 * before counting means two simultaneous requests cannot both slip under the
 * limit. Refused attempts are recorded too, so hammering the endpoint keeps
 * the window full.
 */
export async function consume(limit: RateLimit): Promise<boolean> {
  await getDb().insert(rateLimitEvent).values({ action: limit.action, key: limit.key });
  return (await countEvents(limit.action, limit.key, limit.windowSeconds)) <= limit.max;
}

// Gmail allows 500 recipients per rolling 24 hours for a personal account.
// We stop at 480 to leave room for retries, and warn at 400 (stack doc).
export const MAIL_QUOTA_ACTION = "mail_sent";
export const MAIL_QUOTA_KEY = "global";
export const MAIL_QUOTA_WINDOW_SECONDS = 24 * 60 * 60;
export const MAIL_QUOTA_WARN_AT = 400;
export const MAIL_QUOTA_STOP_AT = 480;
