"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal, DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { declineOffer, makeOffer, OFFER_NOT_FOUND, withdrawOffer, type DecisionResult, type OfferResult } from "@/lib/deals/offers";
import { sendAlertAfterResponse } from "@/lib/notifications/push/schedule";

const idSchema = z.uuid();

// Inputs are typed as unknown: they come from the browser and are checked before anything is written.

/** Makes an offer, or reserves at the asking price, creating the conversation if needed. */
export async function makeOfferAction(postId: unknown, input: unknown): Promise<OfferResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(postId);
  if (!id.success) return { ok: false, error: "That post could not be found." };
  const result = await makeOffer({ responderId: me.id, postId: id.data, input, alert: sendAlertAfterResponse });
  if (result.ok) refresh();
  return result;
}

const GONE: DecisionResult = { ok: false, error: OFFER_NOT_FOUND };

export async function acceptOfferAction(offerId: unknown): Promise<DecisionResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(offerId);
  if (!id.success) return GONE;
  const result = await acceptOffer({ ownerId: me.id, offerId: id.data, alert: sendAlertAfterResponse });
  refresh();
  return result;
}

export async function declineOfferAction(offerId: unknown): Promise<DecisionResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(offerId);
  if (!id.success) return GONE;
  const result = await declineOffer({ ownerId: me.id, offerId: id.data, alert: sendAlertAfterResponse });
  refresh();
  return result;
}

export async function withdrawOfferAction(offerId: unknown): Promise<DecisionResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(offerId);
  if (!id.success) return GONE;
  const result = await withdrawOffer({ responderId: me.id, offerId: id.data });
  refresh();
  return result;
}

/** Either person cancels a reservation that is still being arranged. The units go back to the post. */
export async function cancelDealAction(dealId: unknown): Promise<DecisionResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(dealId);
  if (!id.success) return { ok: false, error: DEAL_NOT_FOUND };
  const result = await cancelDeal({ actorId: me.id, dealId: id.data, alert: sendAlertAfterResponse });
  refresh();
  return result;
}
