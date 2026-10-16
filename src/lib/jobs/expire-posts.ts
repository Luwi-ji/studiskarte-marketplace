import { and, eq, lte } from "drizzle-orm";
import { post } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Moves open posts whose 30 days have passed to "expired". Reserved posts are
 * left alone: they do not expire while a deal is active. Safe to run twice:
 * a second run finds nothing left to change.
 */
export async function expirePosts(now = new Date()): Promise<number> {
  const expired = await getDb()
    .update(post)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(post.status, "open"), lte(post.expiresAt, now)))
    .returning({ id: post.id });
  return expired.length;
}
