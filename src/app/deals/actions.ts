"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal, DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { confirmHandover, type ConfirmResult } from "@/lib/deals/confirm";
import { answerCash, askToPay, confirmPayment, markPaid, rejectPayment, requestCash, type PaymentConfirmResult } from "@/lib/deals/payment";
import { reportDeal } from "@/lib/deals/report";
import { answerProposal, proposeHandover, type HandoverResult } from "@/lib/deals/schedule";
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

const NO_DEAL: HandoverResult = { ok: false, error: DEAL_NOT_FOUND };

/** Proposes a way, time and place to hand it over; the other person is told. */
export async function proposeHandoverAction(dealId: unknown, input: unknown): Promise<HandoverResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(dealId);
  if (!id.success) return NO_DEAL;
  const result = await proposeHandover({ actorId: me.id, dealId: id.data, input, alert: sendAlertAfterResponse });
  refresh();
  return result;
}

/** Agrees to or declines the other person's proposal. */
export async function answerProposalAction(dealId: unknown, agree: unknown): Promise<HandoverResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(dealId);
  if (!id.success || typeof agree !== "boolean") return NO_DEAL;
  const result = await answerProposal({ actorId: me.id, dealId: id.data, agree, alert: sendAlertAfterResponse });
  refresh();
  return result;
}

/** Says the handover happened. The reservation completes when both have said so. */
export async function confirmHandoverAction(dealId: unknown): Promise<ConfirmResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(dealId);
  if (!id.success) return NO_DEAL;
  const result = await confirmHandover({ actorId: me.id, dealId: id.data, alert: sendAlertAfterResponse });
  refresh();
  return result;
}

/** Runs one step of a reservation for the signed-in student and refreshes what the page shows. */
async function act(dealId: unknown, run: (args: { actorId: string; dealId: string; alert: typeof sendAlertAfterResponse }) => Promise<PaymentConfirmResult>): Promise<PaymentConfirmResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(dealId);
  if (!id.success) return NO_DEAL;
  const result = await run({ actorId: me.id, dealId: id.data, alert: sendAlertAfterResponse });
  refresh();
  return result;
}

/** The one being paid asks the other to pay (online or others), once a time and place are agreed. */
export const askToPayAction = async (dealId: unknown, input: unknown) => act(dealId, (a) => askToPay({ ...a, input }));
/** The one paying says they paid, the way they were asked. This secures the slot. */
export const markPaidAction = async (dealId: unknown) => act(dealId, markPaid);
/** The one being paid confirms they received it. */
export const confirmPaymentAction = async (dealId: unknown) => act(dealId, confirmPayment);
/** The one being paid says they did not receive it. */
export const rejectPaymentAction = async (dealId: unknown) => act(dealId, rejectPayment);
/** The one paying asks to pay cash in person. */
export const requestCashAction = async (dealId: unknown) => act(dealId, requestCash);
/** The one being paid agrees to or declines paying cash in person. */
export const answerCashAction = async (dealId: unknown, agree: unknown) => act(dealId, (a) => answerCash({ ...a, agree: agree === true }));
/** Either person reports what went wrong with a secured reservation. */
export const reportDealAction = async (dealId: unknown, input: unknown) => act(dealId, (a) => reportDeal({ ...a, input }));
