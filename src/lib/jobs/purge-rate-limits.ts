import { lt } from "drizzle-orm";
import { rateLimitEvent } from "@/db/schema";
import { getDb } from "@/lib/db";
import { MAIL_QUOTA_WINDOW_SECONDS } from "@/lib/rate-limit";

/**
 * Every limit window is at most a day (the longest is the 24-hour mail count), so
 * rows older than that no longer count for anything. Keeping them would let sign-in
 * attempts, which write a row each, fill the database for nothing.
 */
export const RATE_LIMIT_KEEP_SECONDS = MAIL_QUOTA_WINDOW_SECONDS + 60 * 60;

/** Deletes rate-limit rows older than every window can look back. Safe to run twice. Returns how many were deleted. */
export async function purgeRateLimits(now = new Date()): Promise<number> {
  const deleted = await getDb()
    .delete(rateLimitEvent)
    .where(lt(rateLimitEvent.createdAt, new Date(now.getTime() - RATE_LIMIT_KEEP_SECONDS * 1000)))
    .returning({ id: rateLimitEvent.id });
  return deleted.length;
}
