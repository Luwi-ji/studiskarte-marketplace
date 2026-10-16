import { and, count, eq, gt, inArray } from "drizzle-orm";
import { deal, offer } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/deals/capacity";
import { getDb } from "@/lib/db";

/** Offers on a post that are waiting for the owner (pending and not yet out of time). */
export async function countPendingOffers(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(offer)
    .where(and(eq(offer.postId, postId), eq(offer.status, "pending"), gt(offer.expiresAt, new Date())));
  return row.n;
}

/** Whether this student has a reservation on the post that is still being carried out. */
export async function hasActiveReservation(studentId: string, postId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(deal)
    .where(and(eq(deal.postId, postId), eq(deal.responderId, studentId), inArray(deal.status, [...ACTIVE_STATUSES])));
  return row.n > 0;
}

/** The buyer's own offer or reservation on a post, as the post page needs to show it. */
export type MyTransaction = {
  conversationId: string;
  offerId: string;
  /** A reserve (at the asking price) rather than an offer of their own amount. */
  isReserve: boolean;
  /** Waiting for the owner, or accepted and still being carried out. */
  state: "pending" | "accepted";
  /** The reservation, once accepted: what "cancel" ends. */
  dealId: string | null;
};

/**
 * The buyer's offer on a post that is waiting for the owner (not yet out of
 * time), or accepted with its reservation still being carried out. Null when
 * they have neither, including after it was declined, withdrawn, expired or cancelled.
 */
export async function findMyTransaction(studentId: string, postId: string, now = new Date()): Promise<MyTransaction | null> {
  const db = getDb();
  const [pending] = await db
    .select({ offerId: offer.id, conversationId: offer.conversationId, isReserve: offer.isReserve })
    .from(offer)
    .where(and(eq(offer.postId, postId), eq(offer.responderId, studentId), eq(offer.status, "pending"), gt(offer.expiresAt, now)))
    .limit(1);
  if (pending) return { ...pending, state: "pending", dealId: null };

  const [accepted] = await db
    .select({ offerId: offer.id, conversationId: offer.conversationId, isReserve: offer.isReserve, dealId: deal.id })
    .from(deal)
    .innerJoin(offer, eq(offer.id, deal.offerId))
    .where(and(eq(deal.postId, postId), eq(deal.responderId, studentId), inArray(deal.status, [...ACTIVE_STATUSES])))
    .limit(1);
  return accepted ? { ...accepted, state: "accepted" } : null;
}

export const EDIT_LOCKED = "This post has offers or reservations. Decline or cancel them before editing, so nobody is surprised by a change.";

/** Why a post cannot be edited right now: an offer waiting for the owner, or a reservation being carried out. Null when it can. */
export async function editLockReason(postId: string): Promise<string | null> {
  const [pending, active] = await Promise.all([countPendingOffers(postId), activeReservations(postId)]);
  return pending > 0 || active > 0 ? EDIT_LOCKED : null;
}

/** Reservations on a post that are still being carried out. */
export async function activeReservations(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(deal)
    .where(and(eq(deal.postId, postId), inArray(deal.status, [...ACTIVE_STATUSES])));
  return row.n;
}
