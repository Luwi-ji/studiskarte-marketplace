import { and, eq, exists, inArray, isNull, lte, not, or } from "drizzle-orm";
import { deal, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/deals/capacity";

/** A withdrawn post stays in My posts this long after it was withdrawn. */
export const WITHDRAWN_KEEP_DAYS = 1;
/** An expired post stays in My posts (and can be relisted) this long after it expired. */
export const EXPIRED_KEEP_DAYS = 7;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Takes old withdrawn and expired posts off their owner's list (sets owner_deleted_at),
 * so My posts does not fill up with finished posts. The posts, their offers, reservations
 * and conversations stay in the database. A post with a reservation still being carried out
 * is kept. Relisting an expired post resets its status and expiry, so a relisted post is
 * never purged. Safe to run twice. Returns how many posts were taken off lists.
 */
export async function purgePosts(now = new Date()): Promise<number> {
  const db = getDb();
  const hasActiveDeal = exists(db.select({ one: deal.id }).from(deal).where(and(eq(deal.postId, post.id), inArray(deal.status, [...ACTIVE_STATUSES]))));
  const withdrawnBefore = new Date(now.getTime() - WITHDRAWN_KEEP_DAYS * DAY);
  const expiredBefore = new Date(now.getTime() - EXPIRED_KEEP_DAYS * DAY);
  const purged = await db
    .update(post)
    .set({ ownerDeletedAt: now })
    .where(
      and(
        isNull(post.ownerDeletedAt),
        not(hasActiveDeal),
        or(
          and(eq(post.status, "withdrawn"), lte(post.updatedAt, withdrawnBefore)),
          and(eq(post.status, "expired"), lte(post.expiresAt, expiredBefore)),
        ),
      ),
    )
    .returning({ id: post.id });
  return purged.length;
}
