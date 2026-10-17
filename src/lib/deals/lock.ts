import { eq } from "drizzle-orm";
import { deal, offer, post } from "@/db/schema";
import type { DbTransaction } from "@/lib/db";

export type LockedDeal = {
  id: string;
  postId: string;
  ownerId: string;
  responderId: string;
  status: string;
  createdAt: Date;
  scheduledAt: Date | null;
  proposedBy: string | null;
  proposedMethod: string | null;
  proposedAt: Date | null;
  proposedPlace: string | null;
  ownerConfirmedAt: Date | null;
  responderConfirmedAt: Date | null;
  conversationId: string;
  /** Per unit. */
  amount: number;
  quantity: number;
  paymentMethod: string | null;
  paidAt: Date | null;
  paymentConfirmedAt: Date | null;
  postKind: string;
  exchangeMeetup: boolean;
  exchangeDelivery: boolean;
  paymentCash: boolean;
  paymentOnline: boolean;
  paymentOther: boolean;
  paymentNote: string | null;
};

/**
 * Loads a deal with its post and conversation, holding the post's row lock and
 * then the deal's, in that order everywhere (accepting, cancelling, scheduling,
 * confirming), so two actions on one post line up and never wait on each other.
 */
export async function lockDeal(tx: DbTransaction, dealId: string): Promise<LockedDeal | null> {
  const [ref] = await tx.select({ postId: deal.postId }).from(deal).where(eq(deal.id, dealId));
  if (!ref) return null;
  const [lockedPost] = await tx
    .select({
      postKind: post.kind,
      exchangeMeetup: post.exchangeMeetup,
      exchangeDelivery: post.exchangeDelivery,
      paymentCash: post.paymentCash,
      paymentOnline: post.paymentOnline,
      paymentOther: post.paymentOther,
      paymentNote: post.paymentNote,
    })
    .from(post)
    .where(eq(post.id, ref.postId))
    .for("update");
  const [row] = await tx
    .select({
      id: deal.id,
      postId: deal.postId,
      ownerId: deal.ownerId,
      responderId: deal.responderId,
      status: deal.status,
      createdAt: deal.createdAt,
      scheduledAt: deal.scheduledAt,
      proposedBy: deal.proposedBy,
      proposedMethod: deal.proposedMethod,
      proposedAt: deal.proposedAt,
      proposedPlace: deal.proposedPlace,
      ownerConfirmedAt: deal.ownerConfirmedAt,
      responderConfirmedAt: deal.responderConfirmedAt,
      conversationId: offer.conversationId,
      amount: deal.amount,
      quantity: deal.quantity,
      paymentMethod: deal.paymentMethod,
      paidAt: deal.paidAt,
      paymentConfirmedAt: deal.paymentConfirmedAt,
    })
    .from(deal)
    .innerJoin(offer, eq(offer.id, deal.offerId))
    .where(eq(deal.id, dealId))
    .for("update", { of: deal });
  if (!row || !lockedPost) return null;
  return { ...row, ...lockedPost };
}
