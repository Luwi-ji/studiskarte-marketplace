import { and, count, eq, gt, inArray } from "drizzle-orm";
import { conversation, deal, offer } from "@/db/schema";
import { ACTIVE_STATUSES } from "@/lib/deals/capacity";
import { getDb } from "@/lib/db";

/** Offers on a post that are waiting for the owner (pending and not yet out of time). */
export async function countPendingOffers(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(offer)
    .innerJoin(conversation, eq(conversation.id, offer.conversationId))
    .where(and(eq(conversation.postId, postId), eq(offer.status, "pending"), gt(offer.expiresAt, new Date())));
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

/** The buyer's offer on a post that is still waiting for the owner (not yet out of time), if they have one. */
export async function findPendingOffer(studentId: string, postId: string, now = new Date()): Promise<{ offerId: string; conversationId: string } | null> {
  const [row] = await getDb()
    .select({ offerId: offer.id, conversationId: offer.conversationId })
    .from(offer)
    .innerJoin(conversation, eq(conversation.id, offer.conversationId))
    .where(and(eq(conversation.postId, postId), eq(conversation.responderId, studentId), eq(offer.status, "pending"), gt(offer.expiresAt, now)))
    .limit(1);
  return row ?? null;
}
