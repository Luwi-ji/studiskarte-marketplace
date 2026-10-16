import { and, eq } from "drizzle-orm";
import { conversation, deal, offer, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES, syncAvailability } from "@/lib/deals/capacity";
import type { DecisionResult } from "@/lib/deals/offers";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

export const DEAL_NOT_FOUND = "That reservation could not be found.";
export const DEAL_CLOSED = "This reservation is already closed.";

/**
 * Either person in a reservation can cancel it while it is being arranged. The
 * units go back to the post: a Fully reserved post becomes Active again (with at
 * least a week left), and an Active one simply has more left. The other person
 * is told. Nobody else can cancel it, and it cannot be undone.
 */
export async function cancelDeal(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }): Promise<DecisionResult> {
  const now = args.now ?? new Date();
  let alertFor: string | null = null;

  const result = await getDb().transaction(async (tx): Promise<DecisionResult> => {
    const [ref] = await tx.select({ postId: deal.postId }).from(deal).where(eq(deal.id, args.dealId));
    if (!ref) return { ok: false, error: DEAL_NOT_FOUND };
    // The post first, like accepting: cancelling and accepting on one post line up.
    await tx.select({ id: post.id }).from(post).where(eq(post.id, ref.postId)).for("update");

    const [found] = await tx
      .select({
        ownerId: deal.ownerId,
        responderId: deal.responderId,
        status: deal.status,
        conversationId: offer.conversationId,
      })
      .from(deal)
      .innerJoin(offer, eq(offer.id, deal.offerId))
      .innerJoin(conversation, eq(conversation.id, offer.conversationId))
      .where(eq(deal.id, args.dealId))
      .for("update", { of: deal });
    if (!found || (found.ownerId !== args.actorId && found.responderId !== args.actorId)) return { ok: false, error: DEAL_NOT_FOUND };
    if (!ACTIVE_STATUSES.some((status) => status === found.status)) return { ok: false, error: DEAL_CLOSED };

    await tx
      .update(deal)
      .set({ status: "cancelled", updatedAt: now })
      .where(and(eq(deal.id, args.dealId)));
    await syncAvailability(tx, ref.postId, now);

    const recorded = await recordNotification(tx, {
      type: "deal_cancelled",
      recipientId: found.ownerId === args.actorId ? found.responderId : found.ownerId,
      postId: ref.postId,
      conversationId: found.conversationId,
      onceKey: `deal:${args.dealId}:cancelled`,
    });
    if (recorded?.alert) alertFor = recorded.id;
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && alertFor) args.alert?.(alertFor);
  return result;
}
