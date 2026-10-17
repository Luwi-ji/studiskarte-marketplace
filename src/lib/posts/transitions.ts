import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { deal, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/deals/capacity";

export type WithdrawResult = "ok" | "not_available" | "has_reservations";

/**
 * Withdraws a post the student owns that is open or fully reserved. Withdrawn
 * is final: the post leaves the feed and cannot be relisted (business logic,
 * state transitions). Refused while reservations are still being carried out:
 * cancel them first, so nobody is left waiting for something that is gone.
 */
export async function withdrawPost(ownerId: string, postId: string): Promise<WithdrawResult> {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ status: post.status })
      .from(post)
      .where(and(eq(post.id, postId), eq(post.ownerId, ownerId)))
      .for("update");
    if (!current || (current.status !== "open" && current.status !== "reserved")) return "not_available";
    const [active] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(deal)
      .where(and(eq(deal.postId, postId), inArray(deal.status, [...ACTIVE_STATUSES])));
    if (active.n > 0) return "has_reservations";
    await tx.update(post).set({ status: "withdrawn", updatedAt: new Date() }).where(eq(post.id, postId));
    return "ok";
  });
}

export type DeleteResult = "ok" | "not_available" | "has_reservations";

/**
 * Takes a withdrawn or expired post off the owner's list. Only the list: the post, its
 * offers, reservations and conversations stay, so nobody's history changes. Fulfilled
 * posts are never deletable (they record a finished transaction), and nothing is deleted
 * while a reservation is still being carried out.
 */
export async function deletePost(ownerId: string, postId: string): Promise<DeleteResult> {
  return getDb().transaction(async (tx) => {
    const [current] = await tx
      .select({ status: post.status })
      .from(post)
      .where(and(eq(post.id, postId), eq(post.ownerId, ownerId), isNull(post.ownerDeletedAt)))
      .for("update");
    if (!current || (current.status !== "withdrawn" && current.status !== "expired")) return "not_available";
    const [active] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(deal)
      .where(and(eq(deal.postId, postId), inArray(deal.status, [...ACTIVE_STATUSES])));
    if (active.n > 0) return "has_reservations";
    await tx.update(post).set({ ownerDeletedAt: new Date() }).where(eq(post.id, postId));
    return "ok";
  });
}
