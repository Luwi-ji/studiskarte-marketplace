import { and, eq } from "drizzle-orm";
import { deal } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES, syncAvailability } from "@/lib/deals/capacity";
import { lockDeal, touched } from "@/lib/deals/lock";
import { noticeDetail } from "@/lib/deals/notice-detail";
import { isSecured, SECURED_NO_CANCEL } from "@/lib/deals/slot";
import type { DecisionResult } from "@/lib/deals/offers";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

export const DEAL_NOT_FOUND = "That reservation could not be found.";
export const DEAL_CLOSED = "This reservation is already closed.";

/**
 * Either person in a reservation can cancel it while it is being arranged. The
 * units go back to the post: a Fully reserved post becomes Active again (with at
 * least a week left), and an Active one simply has more left. The other person
 * is told. Nobody else can cancel it, and it cannot be undone. Not possible once
 * the reservation is secured (paid, cash in person agreed, or a handover
 * confirmation said): see report.ts.
 */
export async function cancelDeal(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }): Promise<DecisionResult> {
  const now = args.now ?? new Date();
  let alertFor: string | null = null;

  const result = await getDb().transaction(async (tx): Promise<DecisionResult> => {
    // The post first, like accepting: cancelling and accepting on one post line up.
    const found = await lockDeal(tx, args.dealId);
    if (!found || (found.ownerId !== args.actorId && found.responderId !== args.actorId)) return { ok: false, error: DEAL_NOT_FOUND };
    if (!ACTIVE_STATUSES.some((status) => status === found.status)) return { ok: false, error: DEAL_CLOSED };
    // Once the payer said they paid, cash in person was agreed, or either said the handover happened, only completing or a report ends it.
    if (isSecured(found)) return { ok: false, error: SECURED_NO_CANCEL };

    await tx
      .update(deal)
      .set({ status: "cancelled", ...touched(now) })
      .where(and(eq(deal.id, args.dealId)));
    await syncAvailability(tx, found.postId, now);

    const recorded = await recordNotification(tx, {
      type: "deal_cancelled",
      recipientId: found.ownerId === args.actorId ? found.responderId : found.ownerId,
      postId: found.postId,
      conversationId: found.conversationId,
      onceKey: `deal:${args.dealId}:cancelled`,
      // The time it had been scheduled for, so they can take it off their calendar.
      detail: noticeDetail(found, "deal_cancelled"),
    });
    if (recorded?.alert) alertFor = recorded.id;
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && alertFor) args.alert?.(alertFor);
  return result;
}
