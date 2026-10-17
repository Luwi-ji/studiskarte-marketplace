import { eq } from "drizzle-orm";
import { deal } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/deals/capacity";
import { DEAL_CLOSED, DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { lockDeal, touched, type LockedDeal } from "@/lib/deals/lock";
import { noticeDetail } from "@/lib/deals/notice-detail";
import { parseProposal, type HandoverMethod } from "@/lib/deals/handover";
import { loadAvailability } from "@/lib/posts/availability";
import { recordNotification, type AlertSink, type DealNoticeType, type Recorded } from "@/lib/notifications/record";
import type { Executor } from "@/lib/db";

export type HandoverResult = { ok: true; conversationId: string } | { ok: false; error: string; field?: "method" | "date" | "time" | "place" };

export const NO_PROPOSAL = "There is no proposal to answer.";
const TIME_PASSED = "That time has passed. Propose a new one.";

/** The deal, if the actor is one of its two people and it is still being carried out. */
export function activeFor(found: LockedDeal | null, actorId: string): { found: LockedDeal } | { error: HandoverResult & { ok: false } } {
  if (!found || (found.ownerId !== actorId && found.responderId !== actorId)) return { error: { ok: false, error: DEAL_NOT_FOUND } };
  if (!ACTIVE_STATUSES.some((status) => status === found.status)) return { error: { ok: false, error: DEAL_CLOSED } };
  return { found };
}

/**
 * Tells the other person once per event, with the agreed time and place under
 * the headline (`found` carries the schedule the notice is about). `key` names
 * the event so a repeat is not told twice.
 */
export async function tellOther(tx: Executor, found: LockedDeal, actorId: string, type: DealNoticeType, key: string): Promise<Recorded | null> {
  return recordNotification(tx, {
    type,
    recipientId: found.ownerId === actorId ? found.responderId : found.ownerId,
    postId: found.postId,
    conversationId: found.conversationId,
    onceKey: `deal:${found.id}:${key}`,
    detail: noticeDetail(found, type),
  });
}

/**
 * Either person proposes a way, time and place to hand it over. It replaces
 * any earlier proposal; the other person is told and agrees or declines.
 * The method must be one the post offers. The time must be inside the post's
 * availability, except that the owner may propose any time.
 */
export async function proposeHandover(args: { actorId: string; dealId: string; input: unknown; alert?: AlertSink; now?: Date }): Promise<HandoverResult> {
  const now = args.now ?? new Date();
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<HandoverResult> => {
    const checked = activeFor(await lockDeal(tx, args.dealId), args.actorId);
    if ("error" in checked) return checked.error;
    const { found } = checked;

    const methods: HandoverMethod[] = [...(found.exchangeMeetup ? (["meetup"] as const) : []), ...(found.exchangeDelivery ? (["delivery"] as const) : [])];
    const parsed = parseProposal(args.input, { methods, windows: found.ownerId === args.actorId ? null : await loadAvailability(found.postId) }, now);
    if (!parsed.ok) return parsed;

    await tx
      .update(deal)
      .set({ proposedBy: args.actorId, proposedMethod: parsed.data.method, proposedAt: parsed.data.at, proposedPlace: parsed.data.place, ...touched(now) })
      .where(eq(deal.id, found.id));
    recorded = await tellOther(tx, { ...found, proposedAt: parsed.data.at, proposedPlace: parsed.data.place }, args.actorId, "deal_proposed", `proposed:${now.getTime()}`);
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}

/**
 * The person who did not propose agrees or declines. Agreeing makes the deal
 * scheduled for that method, time and place. A reschedule clears the earlier
 * handover confirmations and a cash handover the payer said but the payee had
 * not confirmed (what was already paid or received stays); declining just
 * clears the proposal.
 */
export async function answerProposal(args: { actorId: string; dealId: string; agree: boolean; alert?: AlertSink; now?: Date }): Promise<HandoverResult> {
  const now = args.now ?? new Date();
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<HandoverResult> => {
    const checked = activeFor(await lockDeal(tx, args.dealId), args.actorId);
    if ("error" in checked) return checked.error;
    const { found } = checked;
    if (!found.proposedBy || !found.proposedAt || !found.proposedMethod || !found.proposedPlace || found.proposedBy === args.actorId) {
      return { ok: false, error: NO_PROPOSAL };
    }
    const cleared = { proposedBy: null, proposedMethod: null, proposedAt: null, proposedPlace: null, ...touched(now) };
    if (!args.agree) {
      await tx.update(deal).set(cleared).where(eq(deal.id, found.id));
      return { ok: true, conversationId: found.conversationId };
    }
    if (found.proposedAt.getTime() <= now.getTime()) {
      await tx.update(deal).set(cleared).where(eq(deal.id, found.id));
      return { ok: false, error: TIME_PASSED };
    }
    await tx
      .update(deal)
      .set({
        ...cleared,
        status: "scheduled",
        handoverMethod: found.proposedMethod,
        scheduledAt: found.proposedAt,
        place: found.proposedPlace,
        ownerConfirmedAt: null,
        responderConfirmedAt: null,
        // A cash handover said but not yet confirmed was about the old time; the payer says it again at the new one.
        ...(found.cashReceivedAt ? {} : { cashGivenAt: null }),
      })
      .where(eq(deal.id, found.id));
    recorded = await tellOther(tx, { ...found, scheduledAt: found.proposedAt, place: found.proposedPlace }, args.actorId, "deal_scheduled", `scheduled:${found.proposedAt.getTime()}:${now.getTime()}`);
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}
