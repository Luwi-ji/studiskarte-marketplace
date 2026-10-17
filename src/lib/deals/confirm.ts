import { eq } from "drizzle-orm";
import { deal } from "@/db/schema";
import { getDb } from "@/lib/db";
import { syncAvailability } from "@/lib/deals/capacity";
import { lockDeal } from "@/lib/deals/lock";
import { readyToComplete } from "@/lib/deals/slot";
import { activeFor, tellOther, type HandoverResult } from "@/lib/deals/schedule";
import type { AlertSink, Recorded } from "@/lib/notifications/record";

export type ConfirmResult = HandoverResult | { ok: true; conversationId: string; completed: boolean };

export const NOT_SCHEDULED = "Agree a time and place first.";

/**
 * One of the two says the handover happened. It can be said at any time once a
 * time and place are agreed, so a handover that happens earlier, or somewhere else,
 * can be confirmed right away. The deal completes when both
 * have said so and the payment is settled (confirmed, or cash in person agreed, or
 * there was nothing to pay), and
 * in no other way (the database refuses it otherwise): the post is then fulfilled if every unit has been handed over. The other person
 * is told either way. Saying it twice changes nothing.
 */
export async function confirmHandover(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }): Promise<ConfirmResult> {
  const now = args.now ?? new Date();
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<ConfirmResult> => {
    const checked = activeFor(await lockDeal(tx, args.dealId), args.actorId);
    if ("error" in checked) return checked.error;
    const { found } = checked;
    if (found.status !== "scheduled" || !found.scheduledAt) return { ok: false, error: NOT_SCHEDULED };

    const asOwner = found.ownerId === args.actorId;
    const mineBefore = asOwner ? found.ownerConfirmedAt : found.responderConfirmedAt;
    if (mineBefore) return { ok: true, conversationId: found.conversationId, completed: false };

    const completed = readyToComplete({
      ...found,
      ownerConfirmedAt: asOwner ? now : found.ownerConfirmedAt,
      responderConfirmedAt: asOwner ? found.responderConfirmedAt : now,
    });
    await tx
      .update(deal)
      .set({ ...(asOwner ? { ownerConfirmedAt: now } : { responderConfirmedAt: now }), ...(completed ? { status: "completed" } : {}), updatedAt: now })
      .where(eq(deal.id, found.id));
    if (completed) await syncAvailability(tx, found.postId, now);
    recorded = await tellOther(tx, found, args.actorId, completed ? "deal_completed" : "deal_confirmed", `${completed ? "completed" : "confirmed"}:${args.actorId}`);
    return { ok: true, conversationId: found.conversationId, completed };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}
