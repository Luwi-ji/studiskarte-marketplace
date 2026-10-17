import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, dealReport, image, notification, post, rateLimitEvent } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal } from "@/lib/deals/cancel";
import { confirmHandover } from "@/lib/deals/confirm";
import { makeOffer } from "@/lib/deals/offers";
import {
  ALREADY_SECURED,
  answerCash,
  askToPay,
  CASH_NOT_GIVEN,
  confirmPayment,
  giveCash,
  markPaid,
  NEEDS_SLOT,
  NOT_ASKED,
  NOT_PAID_YET,
  NOT_PAYEE,
  NOT_PAYER,
  NOTHING_TO_PAY,
  payerOf,
  receiveCash,
  rejectCash,
  rejectPayment,
  requestCash,
} from "@/lib/deals/payment";
import { ALREADY_REPORTED, reportDeal, TOO_EARLY } from "@/lib/deals/report";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { SECURED_NO_CANCEL } from "@/lib/deals/slot";
import { getDb, getPool } from "@/lib/db";
import { expireDeals } from "@/lib/jobs/expire-deals";
import { getConversation } from "@/lib/messaging/read";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `sl-s-${run}`;
const ana = `sl-a-${run}`;
const ben = `sl-b-${run}`;
const people = [seller, ana, ben];
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

async function newPost(opts: { quantity?: string; meetup?: boolean; delivery?: boolean; free?: boolean; wishlist?: boolean; online?: boolean; other?: boolean; cash?: boolean } = {}): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const meetup = opts.meetup ?? true;
  const delivery = opts.delivery ?? false;
  const input: NewPostInput = {
    kind: opts.wishlist ? "wishlist" : "showcase",
    title: `Handover post ${run} #${counter}`,
    description: "A post to hand over.",
    categoryId: "other",
    condition: null,
    priceKind: opts.free ? "free" : "amount",
    priceAmount: opts.free ? "" : "500",
    paymentCash: opts.cash ?? true,
    paymentOnline: opts.online ?? false,
    paymentOther: opts.other ?? false,
    paymentNote: opts.online || opts.other ? "GCash 0917 000 0000" : "",
    quantity: opts.quantity ?? "1",
    exchangeMeetup: meetup,
    exchangeDelivery: delivery,
    meetupLocation: meetup ? "Main gate" : "",
    // Mondays 09:00 to 10:00, Philippine time.
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** A reservation by `buyer`, accepted. */
async function reserved(buyer: string, postId: string): Promise<{ dealId: string; conversationId: string }> {
  const offer = await makeOffer({ responderId: buyer, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  return { dealId: row.id, conversationId: offer.conversationId };
}

/** A coming Monday at 09:30 in the Philippines: inside the post's availability. */
function mondaySlot(): { date: string; time: string; at: Date } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + i * DAY + 8 * HOUR); // the Philippine wall clock, read as UTC
    if (wall.getUTCDay() === 1) {
      const date = wall.toISOString().slice(0, 10);
      return { date, time: "09:30", at: new Date(`${date}T09:30:00+08:00`) };
    }
  }
  throw new Error("no Monday in two weeks");
}

const slot = mondaySlot();
const proposal = (extra: Record<string, unknown> = {}) => ({ method: "meetup", date: slot.date, time: slot.time, place: "Library steps", ...extra });
const dealRow = async (id: string) => (await db.select().from(deal).where(eq(deal.id, id)))[0];
const postStatus = async (id: string) => (await db.select({ s: post.status }).from(post).where(eq(post.id, id)))[0].s;
const noticesFor = async (id: string) => (await db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id))).map((n) => n.type).sort();

/** A scheduled handover at the slot, agreed by Ana (proposes) and the seller (agrees). */
async function scheduled(buyer = ana, postId?: string): Promise<{ postId: string; dealId: string; conversationId: string }> {
  const id = postId ?? (await newPost());
  const r = await reserved(buyer, id);
  expect(await proposeHandover({ actorId: buyer, dealId: r.dealId, input: proposal() })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: seller, dealId: r.dealId, agree: true })).toMatchObject({ ok: true });
  return { postId: id, ...r };
}

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Buyer" });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(conversation).where(or(eq(conversation.participantA, seller), eq(conversation.participantB, seller)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

const after = new Date(slot.at.getTime() + HOUR);
const both = async (dealId: string, buyer = ana) => {
  await confirmHandover({ actorId: buyer, dealId, now: after });
  await confirmHandover({ actorId: seller, dealId, now: after });
};

describe("securing the slot by online payment", () => {
  it("needs a time and place first, then the one being paid asks, the payer pays, and the payee confirms", async () => {
    const postId = await newPost({ cash: false, online: true });
    const { dealId } = await reserved(ana, postId);
    // Before a time and place are agreed there is nothing to do about payment.
    expect(await askToPay({ actorId: seller, dealId })).toEqual({ ok: false, error: NEEDS_SLOT });
    expect(await markPaid({ actorId: ana, dealId })).toEqual({ ok: false, error: NEEDS_SLOT });
    await proposeHandover({ actorId: seller, dealId, input: proposal() });
    await answerProposal({ actorId: ana, dealId, agree: true });
    await db.delete(notification).where(inArray(notification.recipientId, people));

    // Paying comes after being asked, and only the right person does each step.
    expect(await markPaid({ actorId: ana, dealId })).toEqual({ ok: false, error: NOT_ASKED });
    expect(await askToPay({ actorId: ana, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await confirmPayment({ actorId: seller, dealId })).toEqual({ ok: false, error: NOT_PAID_YET });
    expect(await askToPay({ actorId: seller, dealId })).toMatchObject({ ok: true });
    expect(await noticesFor(ana)).toEqual(["deal_payment_requested"]);
    expect(await markPaid({ actorId: seller, dealId })).toEqual({ ok: false, error: NOT_PAYER });

    // Not secured yet, so it can still be cancelled; after paying it cannot.
    expect(await markPaid({ actorId: ana, dealId })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ paymentMethod: "online", paymentConfirmedAt: null });
    expect(await noticesFor(seller)).toEqual(["deal_paid"]);
    expect(await cancelDeal({ actorId: ana, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    expect(await cancelDeal({ actorId: seller, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    await expect(db.update(deal).set({ status: "cancelled" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    expect((await dealRow(dealId)).status).toBe("scheduled");

    expect(await confirmPayment({ actorId: seller, dealId })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(ana)).toEqual(["deal_payment_confirmed", "deal_payment_requested"]);
  });

  it("asks by one of the online ways the post takes, and cash is never asked for", async () => {
    const { dealId } = await scheduled(ana, await newPost({ cash: true, online: true, other: true }));
    expect(await askToPay({ actorId: seller, dealId })).toMatchObject({ ok: false, error: expect.stringContaining("Choose") });
    expect(await askToPay({ actorId: seller, dealId, input: { method: "cash" } })).toMatchObject({ ok: false });
    expect(await askToPay({ actorId: seller, dealId, input: { method: "other" } })).toMatchObject({ ok: true });
    expect((await dealRow(dealId)).paymentAskMethod).toBe("other");
    const cashOnly = await scheduled(ben, await newPost({ cash: true }));
    expect(await askToPay({ actorId: seller, dealId: cashOnly.dealId })).toMatchObject({ ok: false, error: expect.stringContaining("cash only") });
  });

  it("says nothing was received: that undoes the paid, the slot is open again, and the payer is told", async () => {
    const { dealId } = await scheduled(ana, await newPost({ cash: false, online: true }));
    await askToPay({ actorId: seller, dealId });
    await markPaid({ actorId: ana, dealId });
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await rejectPayment({ actorId: ana, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await rejectPayment({ actorId: seller, dealId })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ paidAt: null, paymentMethod: null, status: "scheduled" });
    expect(await noticesFor(ana)).toEqual(["deal_payment_rejected"]);
    // It is no longer secured: it can be cancelled, or paid again.
    expect(await markPaid({ actorId: ana, dealId })).toMatchObject({ ok: true });
    expect(await confirmPayment({ actorId: seller, dealId })).toMatchObject({ ok: true });
    expect(await rejectPayment({ actorId: seller, dealId })).toMatchObject({ ok: false, error: expect.stringContaining("already confirmed") });
  });

  it("completes on whichever comes last: the payment confirmation or the second handover confirmation", async () => {
    const paidFirst = await scheduled(ana, await newPost({ cash: false, online: true }));
    await askToPay({ actorId: seller, dealId: paidFirst.dealId });
    await markPaid({ actorId: ana, dealId: paidFirst.dealId });
    await confirmPayment({ actorId: seller, dealId: paidFirst.dealId });
    await confirmHandover({ actorId: ana, dealId: paidFirst.dealId, now: after });
    expect((await dealRow(paidFirst.dealId)).status).toBe("scheduled");
    expect(await confirmHandover({ actorId: seller, dealId: paidFirst.dealId, now: after })).toMatchObject({ ok: true, completed: true });
    expect(await postStatus(paidFirst.postId)).toBe("fulfilled");

    const handedFirst = await scheduled(ben, await newPost({ cash: false, online: true }));
    await both(handedFirst.dealId, ben);
    expect((await dealRow(handedFirst.dealId)).status).toBe("scheduled");
    await askToPay({ actorId: seller, dealId: handedFirst.dealId });
    await markPaid({ actorId: ben, dealId: handedFirst.dealId });
    expect(await confirmPayment({ actorId: seller, dealId: handedFirst.dealId })).toMatchObject({ ok: true, completed: true });
    expect((await dealRow(handedFirst.dealId)).status).toBe("completed");
  });

  it("is made by the one who posted a Wishlist, to the one who supplies it", async () => {
    const { dealId } = await scheduled(ana, await newPost({ wishlist: true, cash: false, online: true }));
    const row = await dealRow(dealId);
    expect(payerOf({ postKind: "wishlist", ownerId: row.ownerId, responderId: row.responderId })).toBe(seller);
    expect(await askToPay({ actorId: seller, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await askToPay({ actorId: ana, dealId })).toMatchObject({ ok: true });
    expect(await markPaid({ actorId: ana, dealId })).toEqual({ ok: false, error: NOT_PAYER });
    expect(await markPaid({ actorId: seller, dealId })).toMatchObject({ ok: true });
    expect(await confirmPayment({ actorId: ana, dealId })).toMatchObject({ ok: true });
  });
});

describe("securing the slot with cash in person", () => {
  it("is asked by the payer and agreed by the payee, and then nobody can cancel", async () => {
    const { dealId } = await scheduled(ana, await newPost({ cash: true, online: true }));
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await requestCash({ actorId: seller, dealId })).toEqual({ ok: false, error: NOT_PAYER });
    expect(await answerCash({ actorId: seller, dealId, agree: true })).toMatchObject({ ok: false, error: expect.stringContaining("no cash request") });
    expect(await requestCash({ actorId: ana, dealId })).toMatchObject({ ok: true });
    expect(await noticesFor(seller)).toEqual(["deal_cash_requested"]);
    // The payee asking for an online payment now would override the request: answer it first.
    expect(await askToPay({ actorId: seller, dealId, input: { method: "online" } })).toMatchObject({ ok: false, error: expect.stringContaining("Answer their cash request") });
    expect(await answerCash({ actorId: ana, dealId, agree: true })).toEqual({ ok: false, error: NOT_PAYEE });

    // Declined: not secured, and cancelling is still possible.
    expect(await answerCash({ actorId: seller, dealId, agree: false })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ cashRequestedAt: null, cashAgreedAt: null });
    expect(await noticesFor(ana)).toEqual(["deal_cash_answered"]);
    // Asked again and agreed: secured.
    await requestCash({ actorId: ana, dealId });
    expect(await answerCash({ actorId: seller, dealId, agree: true })).toMatchObject({ ok: true, completed: false });
    expect((await dealRow(dealId)).cashAgreedAt).not.toBeNull();
    expect(await cancelDeal({ actorId: seller, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    expect(await cancelDeal({ actorId: ana, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    expect(await requestCash({ actorId: ana, dealId })).toEqual({ ok: false, error: ALREADY_SECURED });
    expect(await markPaid({ actorId: ana, dealId })).toMatchObject({ ok: false });

    // Both confirm the handover, but the cash has not changed hands: it does not complete.
    await confirmHandover({ actorId: ana, dealId, now: after });
    expect(await confirmHandover({ actorId: seller, dealId, now: after })).toMatchObject({ ok: true, completed: false });
    expect((await dealRow(dealId)).status).toBe("scheduled");

    // The cash handshake: the payer says they gave it, then the payee says they received it. Nobody can skip ahead or step in for the other.
    expect(await receiveCash({ actorId: seller, dealId })).toEqual({ ok: false, error: CASH_NOT_GIVEN });
    expect(await giveCash({ actorId: seller, dealId })).toEqual({ ok: false, error: NOT_PAYER });
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await giveCash({ actorId: ana, dealId })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(seller)).toEqual(["deal_cash_given"]);
    expect(await receiveCash({ actorId: ana, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await receiveCash({ actorId: seller, dealId })).toMatchObject({ ok: true, completed: true });
    expect(await noticesFor(ana)).toEqual(["deal_completed"]);
    expect(await dealRow(dealId)).toMatchObject({ status: "completed" });
  });

  it("is only possible when the post takes cash, and works for a delivery as well as a meet-up", async () => {
    const online = await scheduled(ana, await newPost({ cash: false, online: true }));
    expect(await requestCash({ actorId: ana, dealId: online.dealId })).toMatchObject({ ok: false, error: expect.stringContaining("does not take cash") });
    const delivery = await reserved(ben, await newPost({ meetup: false, delivery: true, cash: true }));
    await proposeHandover({ actorId: seller, dealId: delivery.dealId, input: proposal({ method: "delivery" }) });
    await answerProposal({ actorId: ben, dealId: delivery.dealId, agree: true });
    expect(await requestCash({ actorId: ben, dealId: delivery.dealId })).toMatchObject({ ok: true });
  });

  it("completes on whichever comes last: the second handover confirmation or the cash received", async () => {
    const cashFirst = await scheduled();
    await requestCash({ actorId: ana, dealId: cashFirst.dealId });
    await answerCash({ actorId: seller, dealId: cashFirst.dealId, agree: true });
    await giveCash({ actorId: ana, dealId: cashFirst.dealId });
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await receiveCash({ actorId: seller, dealId: cashFirst.dealId })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(ana)).toEqual(["deal_cash_received"]);
    await confirmHandover({ actorId: ana, dealId: cashFirst.dealId, now: after });
    expect(await confirmHandover({ actorId: seller, dealId: cashFirst.dealId, now: after })).toMatchObject({ ok: true, completed: true });

    // Agreeing to the cash after both confirmed the handover does not complete it either: the cash must change hands.
    const { dealId } = await scheduled(ben, await newPost());
    await both(dealId, ben);
    await requestCash({ actorId: ben, dealId });
    expect(await answerCash({ actorId: seller, dealId, agree: true })).toMatchObject({ ok: true, completed: false });
    expect((await dealRow(dealId)).status).toBe("scheduled");
    await giveCash({ actorId: ben, dealId });
    expect(await receiveCash({ actorId: seller, dealId })).toMatchObject({ ok: true, completed: true });
  });

  it("lets the payee say the cash was not received, which puts it back to agreed", async () => {
    const { dealId } = await scheduled();
    await requestCash({ actorId: ana, dealId });
    await answerCash({ actorId: seller, dealId, agree: true });
    expect(await rejectCash({ actorId: seller, dealId })).toEqual({ ok: false, error: CASH_NOT_GIVEN });
    await giveCash({ actorId: ana, dealId });
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await rejectCash({ actorId: ana, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await rejectCash({ actorId: seller, dealId })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ cashGivenAt: null, cashAgreedAt: expect.any(Date) });
    expect(await noticesFor(ana)).toEqual(["deal_payment_rejected"]);
    // Still secured; the payer can say it again, and once received it cannot be taken back.
    expect(await cancelDeal({ actorId: ana, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    await giveCash({ actorId: ana, dealId });
    await receiveCash({ actorId: seller, dealId });
    expect(await rejectCash({ actorId: seller, dealId })).toMatchObject({ ok: false, error: expect.stringContaining("already confirmed") });
  });

  it("says nothing twice: repeating a cash step changes nothing and tells nobody again", async () => {
    const { dealId } = await scheduled();
    await requestCash({ actorId: ana, dealId });
    await answerCash({ actorId: seller, dealId, agree: true });
    await giveCash({ actorId: ana, dealId });
    const given = (await dealRow(dealId)).cashGivenAt;
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await giveCash({ actorId: ana, dealId, now: new Date(Date.now() + HOUR) })).toMatchObject({ ok: true });
    expect((await dealRow(dealId)).cashGivenAt).toEqual(given);
    expect(await noticesFor(seller)).toEqual([]);
  });
});

describe("a free reservation", () => {
  it("has no payment steps, can be cancelled until completed, and completes on the two handover confirmations", async () => {
    const { dealId } = await scheduled(ana, await newPost({ free: true }));
    expect(await askToPay({ actorId: seller, dealId })).toEqual({ ok: false, error: NOTHING_TO_PAY });
    expect(await markPaid({ actorId: ana, dealId })).toEqual({ ok: false, error: NOTHING_TO_PAY });
    expect(await requestCash({ actorId: ana, dealId })).toEqual({ ok: false, error: NOTHING_TO_PAY });
    await both(dealId);
    expect((await dealRow(dealId)).status).toBe("completed");
    const other = await scheduled(ben, await newPost({ free: true }));
    expect(await cancelDeal({ actorId: ben, dealId: other.dealId })).toMatchObject({ ok: true });
  });
});

describe("what each side sees", () => {
  it("shows the stage, whose turn it is, and whether the slot is secured", async () => {
    const { dealId, conversationId } = await scheduled(ana, await newPost({ cash: true, online: true }));
    const card = async (who: string) => (await getConversation(who, conversationId))?.messages[0].offer?.deal;
    expect(await card(ana)).toMatchObject({ secured: false, canReport: false, payment: { viewerPays: true, stage: "open", total: 500, note: "GCash 0917 000 0000", modes: ["cash", "online"] } });
    expect(await card(seller)).toMatchObject({ payment: { viewerPays: false, stage: "open" } });
    await askToPay({ actorId: seller, dealId });
    expect(await card(ana)).toMatchObject({ payment: { stage: "asked", askMethod: "online" } });
    await markPaid({ actorId: ana, dealId });
    expect(await card(seller)).toMatchObject({ secured: true, canReport: true, payment: { stage: "paid", method: "online" } });
    await confirmPayment({ actorId: seller, dealId });
    expect(await card(ana)).toMatchObject({ secured: true, payment: { stage: "confirmed" } });
  });
});

describe("reporting what happened", () => {
  const report = (extra: Record<string, unknown> = {}) => ({ fault: "theirs", reason: "no_show", details: "Did not come", ...extra });
  const secured = async (buyer = ana) => {
    const r = await scheduled(buyer, await newPost({ cash: true }));
    await requestCash({ actorId: buyer, dealId: r.dealId });
    await answerCash({ actorId: seller, dealId: r.dealId, agree: true });
    return r;
  };

  it("is for a secured reservation, or one whose time has passed, and not before", async () => {
    const early = await scheduled();
    expect(await reportDeal({ actorId: ana, dealId: early.dealId, input: report() })).toEqual({ ok: false, error: TOO_EARLY });
    expect((await dealRow(early.dealId)).status).toBe("scheduled");
    // Its time has come and gone without it being completed: now it can be reported.
    await db.update(deal).set({ scheduledAt: new Date(Date.now() - HOUR) }).where(eq(deal.id, early.dealId));
    expect(await reportDeal({ actorId: ana, dealId: early.dealId, input: report() })).toMatchObject({ ok: true });
    // A reservation with no agreed time cannot be reported: it can be cancelled.
    const agreed = await reserved(ben, await newPost());
    expect(await reportDeal({ actorId: ben, dealId: agreed.dealId, input: report() })).toEqual({ ok: false, error: TOO_EARLY });
  });

  it("closes the reservation, puts the units back on the post, tells the other person, and lets them add their side", async () => {
    const { dealId, postId, conversationId } = await secured();
    expect(await postStatus(postId)).toBe("reserved");
    await db.delete(notification).where(inArray(notification.recipientId, people));

    expect(await reportDeal({ actorId: ana, dealId, input: report({ fault: "theirs", reason: "no_show", details: "  The seller never came  " }) })).toEqual({ ok: true, conversationId });
    expect(await dealRow(dealId)).toMatchObject({ status: "disputed" });
    expect(await postStatus(postId)).toBe("open");
    expect(await noticesFor(seller)).toEqual(["deal_reported"]);
    expect(await reportDeal({ actorId: ana, dealId, input: report() })).toEqual({ ok: false, error: ALREADY_REPORTED });

    const reports = await db.select().from(dealReport).where(eq(dealReport.dealId, dealId));
    expect(reports).toMatchObject([{ reporterId: ana, faultPartyId: seller, reason: "no_show", details: "The seller never came" }]);

    // The other side sees it, and can add theirs; the reporter has nothing more to add.
    const seen = (await getConversation(seller, conversationId))?.messages[0].offer?.deal;
    expect(seen).toMatchObject({ status: "disputed", canReport: true, reports: [{ mine: false, blames: "me", reason: "no_show" }] });
    expect((await getConversation(ana, conversationId))?.messages[0].offer?.deal).toMatchObject({ canReport: false, reports: [{ mine: true, blames: "them" }] });
    expect(await reportDeal({ actorId: seller, dealId, input: report({ fault: "unsure", reason: "other", details: "" }) })).toMatchObject({ ok: true });
    expect(await noticesFor(ana)).toEqual(["deal_reported"]);
    expect((await getConversation(ana, conversationId))?.messages[0].offer?.deal?.reports).toMatchObject([{ mine: true }, { mine: false, blames: null, details: null }]);
    expect((await getConversation(seller, conversationId))?.listings[0].state).toBe("Reported");

    // It is over: no more steps, no completing, no cancelling.
    expect(await confirmHandover({ actorId: ana, dealId, now: after })).toMatchObject({ ok: false });
    expect(await cancelDeal({ actorId: ana, dealId })).toMatchObject({ ok: false });
    await expect(db.update(deal).set({ status: "scheduled" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("refuses strangers, completed reservations, and reports that are missing the point or too long", async () => {
    const { dealId } = await secured();
    expect(await reportDeal({ actorId: ben, dealId, input: report() })).toMatchObject({ ok: false });
    expect(await reportDeal({ actorId: ana, dealId, input: report({ fault: "everyone" }) })).toMatchObject({ ok: false });
    expect(await reportDeal({ actorId: ana, dealId, input: report({ reason: "rude" }) })).toMatchObject({ ok: false });
    expect(await reportDeal({ actorId: ana, dealId, input: report({ details: "x".repeat(1001) }) })).toMatchObject({ ok: false });
    expect(await reportDeal({ actorId: ana, dealId, input: report({ details: "x".repeat(501) }) })).toMatchObject({ ok: false, error: expect.stringContaining("at most 500") });
    expect((await dealRow(dealId)).status).toBe("scheduled");
    await both(dealId);
    expect((await dealRow(dealId)).status).toBe("scheduled"); // the cash is still to change hands
    await giveCash({ actorId: ana, dealId });
    expect(await receiveCash({ actorId: seller, dealId })).toMatchObject({ ok: true, completed: true });
    expect(await reportDeal({ actorId: ana, dealId, input: report() })).toMatchObject({ ok: false });
  });

  it("is kept honest by the database: only the two people, blaming one of them, once each", async () => {
    const { dealId } = await secured();
    await expect(db.insert(dealReport).values({ dealId, reporterId: ben, reason: "other" })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(dealReport).values({ dealId, reporterId: ana, faultPartyId: ben, reason: "other" })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(dealReport).values({ dealId, reporterId: ana, reason: "rude" })).rejects.toMatchObject({ cause: { code: "23514" } });
    await db.insert(dealReport).values({ dealId, reporterId: ana, reason: "other" });
    await expect(db.insert(dealReport).values({ dealId, reporterId: ana, reason: "other" })).rejects.toMatchObject({ cause: { code: "23505" } });
  });
});

describe("a secured reservation nobody completed", () => {
  it("is not cancelled after 7 days but sent for a look as disputed, and the post reopens; an unsecured one is cancelled", async () => {
    const lockedDeal = await scheduled(ana, await newPost({ cash: true }));
    await requestCash({ actorId: ana, dealId: lockedDeal.dealId });
    await answerCash({ actorId: seller, dealId: lockedDeal.dealId, agree: true });
    const open = await scheduled(ben, await newPost({ cash: true }));
    for (const id of [lockedDeal.dealId, open.dealId]) await db.update(deal).set({ scheduledAt: new Date(Date.now() - 8 * DAY) }).where(eq(deal.id, id));
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await expireDeals();
    expect((await dealRow(lockedDeal.dealId)).status).toBe("disputed");
    expect((await dealRow(open.dealId)).status).toBe("cancelled");
    expect(await postStatus(lockedDeal.postId)).toBe("open");
    expect(await postStatus(open.postId)).toBe("open");
    expect(await noticesFor(ana)).toEqual(["deal_disputed"]);
    expect(await noticesFor(ben)).toEqual(["deal_expired"]);
    expect(await expireDeals()).toBe(0);
  });
});

describe("rules the database keeps about payment", () => {
  it("refuses completing without a settled payment, a confirmation before paying, a way the post does not take, and bad payment modes on a post", async () => {
    const { dealId, postId } = await scheduled();
    const now = new Date();
    await expect(
      db.update(deal).set({ status: "completed", ownerConfirmedAt: now, responderConfirmedAt: now }).where(eq(deal.id, dealId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ paymentConfirmedAt: now }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ paymentMethod: "online", paidAt: now }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } }); // the post takes cash only
    await expect(db.update(deal).set({ paymentMethod: "cash" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } }); // a way with no time
    await expect(db.update(deal).set({ cashAgreedAt: now }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } }); // agreed but never asked
    await expect(db.update(deal).set({ cashRequestedAt: now, cashAgreedAt: now, status: "completed", ownerConfirmedAt: now, responderConfirmedAt: now }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } }); // cash agreed is not cash received
    await expect(db.update(deal).set({ cashGivenAt: now }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } }); // given but never agreed
    await expect(db.update(deal).set({ cashRequestedAt: now, cashAgreedAt: now, cashReceivedAt: now }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } }); // received but never given
    await expect(db.update(deal).set({ paymentAskMethod: "online" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(post).set({ paymentCash: false }).where(eq(post.id, postId))).rejects.toMatchObject({ cause: { code: "23514" } }); // priced, none left
    await expect(db.update(post).set({ paymentNote: "GCash" }).where(eq(post.id, postId))).rejects.toMatchObject({ cause: { code: "23514" } }); // a note with cash only
    const freePost = await newPost({ free: true });
    await expect(db.update(post).set({ paymentCash: true }).where(eq(post.id, freePost))).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});
