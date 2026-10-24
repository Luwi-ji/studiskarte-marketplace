import { and, count, eq, inArray } from "drizzle-orm";
import { deal, post, student } from "@/db/schema";
import type { Executor } from "@/lib/db";
import { idCheckIsCurrent, UNCHECKED_SHOWCASE_MAX, verificationEnabled } from "@/lib/verification/config";

export const SHOWCASE_NEEDS_ID_CHECK = `Until your first sale you can have ${UNCHECKED_SHOWCASE_MAX} open showcase at a time. Check your ID in Settings to post more.`;
export const SHOWCASE_NEEDS_ID_AFTER_SALE = "Your first showcase sale is complete. Check your ID in Settings to post more showcases.";

/** Why a student without a current ID check cannot add another showcase: `sold` (a showcase sale is complete) or `limit` (one is already open). */
export type ShowcaseBlock = "sold" | "limit";
/** `off` ID checks are closed, `checked` has a current ID check, `free` may post one more, else blocked. */
export type ShowcaseStanding = "off" | "checked" | "free" | ShowcaseBlock;

export const SHOWCASE_BLOCK_MESSAGE: Record<ShowcaseBlock, string> = {
  sold: SHOWCASE_NEEDS_ID_AFTER_SALE,
  limit: SHOWCASE_NEEDS_ID_CHECK,
};

/**
 * What stops a student from adding a showcase, or null. Applies only once ID checks are open (otherwise nobody could
 * lift it) and only without a current ID check. A completed showcase sale ends the allowance for good, even if that
 * listing was deleted since: a deal and its history stay when its post is deleted. Otherwise one open, reserved or
 * hidden showcase is the limit, so a withdrawn or deleted one that sold nothing frees the slot.
 */
export async function showcaseBlock(db: Executor, ownerId: string, check: { checkedAt: Date | null; expiresAt: Date | null }): Promise<ShowcaseBlock | null> {
  if (!verificationEnabled() || idCheckIsCurrent(check.checkedAt, check.expiresAt)) return null;
  const [sold] = await db
    .select({ id: deal.id })
    .from(deal)
    .innerJoin(post, eq(post.id, deal.postId))
    .where(and(eq(deal.ownerId, ownerId), eq(deal.status, "completed"), eq(post.kind, "showcase")))
    .limit(1);
  if (sold) return "sold";
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
