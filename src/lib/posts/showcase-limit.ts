import { and, count, eq, inArray, or } from "drizzle-orm";
import { deal, post, student } from "@/db/schema";
import type { Executor } from "@/lib/db";
import { idCheckIsCurrent, UNCHECKED_SHOWCASE_MAX, verificationEnabled } from "@/lib/verification/config";

export const SHOWCASE_NEEDS_ID_CHECK = `Until your first sale you can have ${UNCHECKED_SHOWCASE_MAX} open showcase at a time. Check your ID in Settings to post more.`;
export const SHOWCASE_NEEDS_ID_AFTER_SALE = "Your first sale is complete. Check your ID in Settings to post more showcases.";
export const WISHLIST_NEEDS_ID_AFTER_SALE = "Your first sale is complete. Check your ID in Settings to answer Wishlists and sell more.";

/** Why a student without a current ID check cannot add another showcase: `sold` (a sale is complete) or `limit` (one is already open). */
export type ShowcaseBlock = "sold" | "limit";
/** `off` ID checks are closed, `checked` has a current ID check, `free` may post one more, else blocked. */
export type ShowcaseStanding = "off" | "checked" | "free" | ShowcaseBlock;

export const SHOWCASE_BLOCK_MESSAGE: Record<ShowcaseBlock, string> = {
  sold: SHOWCASE_NEEDS_ID_AFTER_SALE,
  limit: SHOWCASE_NEEDS_ID_CHECK,
};

type Check = { checkedAt: Date | null; expiresAt: Date | null };

/**
 * Has this student completed a sale: a Showcase of theirs, or a Wishlist they supplied (on a Wishlist the one who
 * answers it is the seller)? A free handover counts. A deal and its history stay when its post is deleted, so a sale
 * counts for good.
 */
async function hasSold(db: Executor, studentId: string): Promise<boolean> {
  const [sold] = await db
    .select({ id: deal.id })
    .from(deal)
    .innerJoin(post, eq(post.id, deal.postId))
    .where(
      and(
        eq(deal.status, "completed"),
        or(and(eq(post.kind, "showcase"), eq(deal.ownerId, studentId)), and(eq(post.kind, "wishlist"), eq(deal.responderId, studentId))),
      ),
    )
    .limit(1);
  return sold !== undefined;
}

/**
 * Whether a student without a current ID check may no longer start selling: their first sale is complete. Applies only
 * once ID checks are open (otherwise nobody could lift it). It stops answering a Wishlist; deals already in progress and
 * the listings already open carry on.
 */
export async function supplyBlock(db: Executor, studentId: string, check: Check): Promise<boolean> {
  if (!verificationEnabled() || idCheckIsCurrent(check.checkedAt, check.expiresAt)) return false;
  return hasSold(db, studentId);
}

/** The same, reading the student's ID check itself. */
export async function isSupplyBlocked(db: Executor, studentId: string): Promise<boolean> {
  if (!verificationEnabled()) return false;
  const [me] = await db.select({ checkedAt: student.idCheckedAt, expiresAt: student.idCheckExpiresAt }).from(student).where(eq(student.id, studentId));
  return me ? supplyBlock(db, studentId, me) : false;
}

/**
 * What stops a student from adding a showcase, or null. Without a current ID check, a completed sale ends the allowance
 * for good (see `hasSold`). Otherwise one open, reserved or hidden showcase is the limit, so a withdrawn or deleted one
 * that sold nothing frees the slot.
 */
export async function showcaseBlock(db: Executor, ownerId: string, check: Check): Promise<ShowcaseBlock | null> {
  if (!verificationEnabled() || idCheckIsCurrent(check.checkedAt, check.expiresAt)) return null;
  if (await hasSold(db, ownerId)) return "sold";
  const [{ showcases }] = await db
    .select({ showcases: count() })
    .from(post)
    .where(and(eq(post.ownerId, ownerId), eq(post.kind, "showcase"), inArray(post.status, ["open", "reserved", "hidden"])));
  return showcases >= UNCHECKED_SHOWCASE_MAX ? "limit" : null;
}

/** Where a student stands, for the reminders. */
export async function showcaseStanding(db: Executor, ownerId: string): Promise<ShowcaseStanding> {
  if (!verificationEnabled()) return "off";
  const [me] = await db.select({ checkedAt: student.idCheckedAt, expiresAt: student.idCheckExpiresAt }).from(student).where(eq(student.id, ownerId));
  if (!me) return "off";
  if (idCheckIsCurrent(me.checkedAt, me.expiresAt)) return "checked";
  return (await showcaseBlock(db, ownerId, me)) ?? "free";
}
