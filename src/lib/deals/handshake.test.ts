import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal } from "@/lib/deals/cancel";
import { ALREADY_SAID, confirmHandover, NOTHING_TO_DENY, rejectHandover } from "@/lib/deals/confirm";
import { noticeDetail } from "@/lib/deals/notice-detail";
import { makeOffer } from "@/lib/deals/offers";
import {
  answerCash,
  askToPay,
  CASH_NOT_AGREED,
  CASH_NOT_GIVEN,
  confirmPayment,
  giveCash,
  markPaid,
  NOT_ASKED,
  NOT_PAID_YET,
  NOT_PAYEE,
  NOT_PAYER,
  payerOf,
  receiveCash,
  rejectCash,
  rejectPayment,
  requestCash,
} from "@/lib/deals/payment";
import { reportDeal } from "@/lib/deals/report";
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
const seller = `hs-s-${run}`;
const ana = `hs-a-${run}`;
const ben = `hs-b-${run}`;
const people = [seller, ana, ben];
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

/** The seller owns every post. On a Wishlist the seller is the one who posted it (pays and receives), Ana supplies it. */
async function newPost(opts: { wishlist?: boolean; free?: boolean; online?: boolean; cash?: boolean } = {}): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: opts.wishlist ? "wishlist" : "showcase",
    title: `Handshake post ${run} #${counter}`,
    description: "A post to hand over.",
    categoryId: "other",
    condition: null,
    priceKind: opts.free ? "free" : "amount",
    priceAmount: opts.free ? "" : "500",
    paymentCash: opts.cash ?? true,
    paymentOnline: opts.online ?? false,
    paymentOther: false,
    paymentNote: opts.online ? "GCash 0917 000 0000" : "",
    quantity: "1",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Main gate",
    // Mondays 09:00 to 10:00, Philippine time.
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** A reservation by `responder`, accepted by the seller. */
async function reserved(responder: string, postId: string): Promise<{ dealId: string; conversationId: string }> {
  const offer = await makeOffer({ responderId: responder, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  return { dealId: row.id, conversationId: offer.conversationId };
}

/** The nth coming Monday at 09:30 in the Philippines: inside the posts' availability. */
function mondaySlot(skip = 0): { date: string; time: string; at: Date } {
  let seen = 0;
  for (let i = 1; i <= 40; i++) {
    const wall = new Date(Date.now() + i * DAY + 8 * HOUR); // the Philippine wall clock, read as UTC
    if (wall.getUTCDay() === 1 && seen++ >= skip) {
      const date = wall.toISOString().slice(0, 10);
      return { date, time: "09:30", at: new Date(`${date}T09:30:00+08:00`) };
    }
  }
  throw new Error("no Monday found");
}

const first = mondaySlot();
const proposal = (slot = first, place = "Library steps") => ({ method: "meetup", date: slot.date, time: slot.time, place });
const dealRow = async (id: string) => (await db.select().from(deal).where(eq(deal.id, id)))[0];
const noticesFor = async (id: string) => (await db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id))).map((n) => n.type).sort();
const clearNotices = () => db.delete(notification).where(inArray(notification.recipientId, people));
const after = new Date(first.at.getTime() + HOUR);

/** A scheduled handover at the first slot: the responder proposes, the seller agrees. */
async function scheduled(postId: string, responder = ana): Promise<{ postId: string; dealId: string; conversationId: string }> {
  const r = await reserved(responder, postId);
  expect(await proposeHandover({ actorId: responder, dealId: r.dealId, input: proposal() })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: seller, dealId: r.dealId, agree: true })).toMatchObject({ ok: true });
  return { postId, ...r };
}

/** Both people say the handover happened. */
const bothConfirm = async (dealId: string) => {
  await confirmHandover({ actorId: ana, dealId, now: after });
  await confirmHandover({ actorId: seller, dealId, now: after });
};

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Responder" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Responder" });
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

/** On a Showcase Ana buys from the seller; on a Wishlist the seller posted it, so the seller pays and Ana supplies it. */
const kinds = [
  { kind: "showcase", wishlist: false, payer: ana, payee: seller },
  { kind: "wishlist", wishlist: true, payer: seller, payee: ana },
];

describe.each(kinds)("$kind: the online handshake", ({ wishlist, payer, payee }) => {
  it("is asked by the payee, said by the payer and confirmed by the payee, each told to the other side", async () => {
    const { dealId } = await scheduled(await newPost({ wishlist, cash: false, online: true }));
    const row = await dealRow(dealId);
    expect(payerOf({ postKind: wishlist ? "wishlist" : "showcase", ownerId: row.ownerId, responderId: row.responderId })).toBe(payer);
    await clearNotices();

    expect(await markPaid({ actorId: payer, dealId })).toEqual({ ok: false, error: NOT_ASKED });
    expect(await askToPay({ actorId: payer, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await askToPay({ actorId: payee, dealId })).toMatchObject({ ok: true });
    expect(await noticesFor(payer)).toEqual(["deal_payment_requested"]);
    expect(await noticesFor(payee)).toEqual([]);

    // The payee cannot confirm what the payer never said, and cannot say it for them.
    expect(await confirmPayment({ actorId: payee, dealId })).toEqual({ ok: false, error: NOT_PAID_YET });
    expect(await markPaid({ actorId: payee, dealId })).toEqual({ ok: false, error: NOT_PAYER });
    await clearNotices();
    expect(await markPaid({ actorId: payer, dealId })).toMatchObject({ ok: true });
    expect(await noticesFor(payee)).toEqual(["deal_paid"]);
    expect(await confirmPayment({ actorId: payer, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await cancelDeal({ actorId: payer, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    expect(await cancelDeal({ actorId: payee, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    await clearNotices();
    expect(await confirmPayment({ actorId: payee, dealId })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(payer)).toEqual(["deal_payment_confirmed"]);
  });

  it("completes only once both handover confirmations and the payment confirmation exist, in any order", async () => {
    const { dealId } = await scheduled(await newPost({ wishlist, cash: false, online: true }));
    await askToPay({ actorId: payee, dealId });
    await markPaid({ actorId: payer, dealId });
    await confirmHandover({ actorId: payer, dealId, now: after });
    await confirmHandover({ actorId: payee, dealId, now: after });
    // Both handed over, but the payee has not confirmed the payment.
    expect((await dealRow(dealId)).status).toBe("scheduled");
    await clearNotices();
    expect(await confirmPayment({ actorId: payee, dealId })).toMatchObject({ ok: true, completed: true });
    expect(await noticesFor(payer)).toEqual(["deal_completed"]);
    expect((await dealRow(dealId)).status).toBe("completed");
  });
});

describe.each(kinds)("$kind: the cash handshake", ({ wishlist, payer, payee }) => {
  it("goes request, agree, given, received: nobody skips ahead, nobody cancels once agreed, and it completes only after both handovers and the cash received", async () => {
    const { dealId, conversationId } = await scheduled(await newPost({ wishlist, cash: true }));
    await clearNotices();

    // The payer asks, the payee answers.
    expect(await requestCash({ actorId: payee, dealId })).toEqual({ ok: false, error: NOT_PAYER });
    expect(await requestCash({ actorId: payer, dealId })).toMatchObject({ ok: true });
    expect(await noticesFor(payee)).toEqual(["deal_cash_requested"]);
    expect(await giveCash({ actorId: payer, dealId })).toEqual({ ok: false, error: CASH_NOT_AGREED });
    expect(await receiveCash({ actorId: payee, dealId })).toEqual({ ok: false, error: CASH_NOT_GIVEN });
    expect(await answerCash({ actorId: payer, dealId, agree: true })).toEqual({ ok: false, error: NOT_PAYEE });
    await clearNotices();
    expect(await answerCash({ actorId: payee, dealId, agree: true })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(payer)).toEqual(["deal_cash_answered"]);

    // Agreed is not settled: both confirming the handover is not enough.
    await bothConfirm(dealId);
    expect((await dealRow(dealId)).status).toBe("scheduled");
    expect(await cancelDeal({ actorId: payer, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    expect(await cancelDeal({ actorId: payee, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });

    // The payee cannot confirm before the payer says they gave it, and neither says it for the other.
    expect(await receiveCash({ actorId: payee, dealId })).toEqual({ ok: false, error: CASH_NOT_GIVEN });
    expect(await giveCash({ actorId: payee, dealId })).toEqual({ ok: false, error: NOT_PAYER });
    await clearNotices();
    expect(await giveCash({ actorId: payer, dealId })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(payee)).toEqual(["deal_cash_given"]);
    expect(await receiveCash({ actorId: payer, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect((await dealRow(dealId)).status).toBe("scheduled");

    // Each side reads its own part: the payer receives the item, the payee hands it over, on both kinds of post.
    const card = async (who: string) => (await getConversation(who, conversationId))?.messages[0].offer?.deal;
    expect(await card(payer)).toMatchObject({ viewerHandsOver: false, secured: true, payment: { viewerPays: true, stage: "cash_given" } });
    expect(await card(payee)).toMatchObject({ viewerHandsOver: true, secured: true, payment: { viewerPays: false, stage: "cash_given" } });

    await clearNotices();
    expect(await receiveCash({ actorId: payee, dealId })).toMatchObject({ ok: true, completed: true });
    expect(await noticesFor(payer)).toEqual(["deal_completed"]);
    expect(await dealRow(dealId)).toMatchObject({ status: "completed", cashGivenAt: expect.any(Date), cashReceivedAt: expect.any(Date) });
    expect(await card(payer)).toMatchObject({ payment: { stage: "cash_received" } });
  });

  it("settles the cash before the handover is confirmed, and then completes on the second handover confirmation", async () => {
    const { dealId } = await scheduled(await newPost({ wishlist, cash: true }));
    await requestCash({ actorId: payer, dealId });
    await answerCash({ actorId: payee, dealId, agree: true });
    await giveCash({ actorId: payer, dealId });
    await clearNotices();
    expect(await receiveCash({ actorId: payee, dealId })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(payer)).toEqual(["deal_cash_received"]);
    await confirmHandover({ actorId: payer, dealId, now: after });
    expect((await dealRow(dealId)).status).toBe("scheduled");
    await clearNotices();
    expect(await confirmHandover({ actorId: payee, dealId, now: after })).toMatchObject({ ok: true, completed: true });
    expect(await noticesFor(payer)).toEqual(["deal_completed"]);
  });

  it("lets the payee say the cash was not received; it goes back to agreed and the payer is told", async () => {
    const { dealId } = await scheduled(await newPost({ wishlist, cash: true }));
    await requestCash({ actorId: payer, dealId });
    await answerCash({ actorId: payee, dealId, agree: true });
    expect(await rejectCash({ actorId: payee, dealId })).toEqual({ ok: false, error: CASH_NOT_GIVEN });
    await giveCash({ actorId: payer, dealId });
    await clearNotices();
    expect(await rejectCash({ actorId: payer, dealId })).toEqual({ ok: false, error: NOT_PAYEE });
    expect(await rejectCash({ actorId: payee, dealId })).toMatchObject({ ok: true });
    expect(await noticesFor(payer)).toEqual(["deal_payment_rejected"]);
    expect(await dealRow(dealId)).toMatchObject({ cashGivenAt: null, cashAgreedAt: expect.any(Date) });
    expect(await cancelDeal({ actorId: payer, dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
  });

  it("keeps the payment through a reschedule, but the payer says again that the cash was given at the new time", async () => {
    const { dealId } = await scheduled(await newPost({ wishlist, cash: true }));
    await requestCash({ actorId: payer, dealId });
    await answerCash({ actorId: payee, dealId, agree: true });
    await confirmHandover({ actorId: payer, dealId, now: after });
    await giveCash({ actorId: payer, dealId });

    const later = mondaySlot(1);
    expect(await proposeHandover({ actorId: payee, dealId, input: proposal(later) })).toMatchObject({ ok: true });
    expect(await answerProposal({ actorId: payer, dealId, agree: true })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({
      scheduledAt: later.at,
      ownerConfirmedAt: null,
      responderConfirmedAt: null,
      cashGivenAt: null,
      cashAgreedAt: expect.any(Date),
      status: "scheduled",
    });

    // Once the cash was received it stays received, whatever happens to the time.
    await giveCash({ actorId: payer, dealId });
    await receiveCash({ actorId: payee, dealId });
    const latest = mondaySlot(2);
    await proposeHandover({ actorId: payer, dealId, input: proposal(latest) });
    await answerProposal({ actorId: payee, dealId, agree: true });
    expect(await dealRow(dealId)).toMatchObject({ scheduledAt: latest.at, cashGivenAt: expect.any(Date), cashReceivedAt: expect.any(Date) });
  });
});

describe("a handover somebody said happened", () => {
  it("can no longer be cancelled by the other person, only reported; a reschedule clears it", async () => {
    const free = await scheduled(await newPost({ free: true }));
    expect(await confirmHandover({ actorId: ana, dealId: free.dealId, now: after })).toMatchObject({ ok: true, completed: false });
    expect(await cancelDeal({ actorId: seller, dealId: free.dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    expect(await cancelDeal({ actorId: ana, dealId: free.dealId })).toEqual({ ok: false, error: SECURED_NO_CANCEL });
    const card = (await getConversation(seller, free.conversationId))?.messages[0].offer?.deal;
    expect(card).toMatchObject({ secured: true, canReport: true, confirmedByOther: true });
    expect(await reportDeal({ actorId: seller, dealId: free.dealId, input: { fault: "theirs", reason: "other", details: "Never got it" } })).toMatchObject({ ok: true });
    expect((await dealRow(free.dealId)).status).toBe("disputed");

    // Rescheduled: nothing was said about the new time, so it can be cancelled again.
    const again = await scheduled(await newPost({ free: true }), ben);
    await confirmHandover({ actorId: ben, dealId: again.dealId, now: after });
    await proposeHandover({ actorId: seller, dealId: again.dealId, input: proposal(mondaySlot(1)) });
    await answerProposal({ actorId: ben, dealId: again.dealId, agree: true });
    expect(await cancelDeal({ actorId: seller, dealId: again.dealId })).toMatchObject({ ok: true });
  });
});

describe("the activity of a reservation", () => {
  it("is moved to the moment of every step, by either person", async () => {
    const { dealId } = await scheduled(await newPost({ cash: true, online: true }));
    const t = (n: number) => new Date(Date.now() + n * 1000);
    const activityAfter = async (step: () => Promise<unknown>, at: Date) => {
      await step();
      expect((await dealRow(dealId)).activityAt).toEqual(at);
    };
    let n = 1;
    const at = () => t(n++);
    let when = at();
    await activityAfter(() => proposeHandover({ actorId: ana, dealId, input: proposal(mondaySlot(1)), now: when }), when);
    when = at();
    await activityAfter(() => answerProposal({ actorId: seller, dealId, agree: false, now: when }), when);
    when = at();
    await activityAfter(() => proposeHandover({ actorId: seller, dealId, input: proposal(mondaySlot(1)), now: when }), when);
    when = at();
    await activityAfter(() => answerProposal({ actorId: ana, dealId, agree: true, now: when }), when);
    when = at();
    await activityAfter(() => askToPay({ actorId: seller, dealId, input: { method: "online" }, now: when }), when);
    when = at();
    await activityAfter(() => markPaid({ actorId: ana, dealId, now: when }), when);
    when = at();
    await activityAfter(() => rejectPayment({ actorId: seller, dealId, now: when }), when);
    when = at();
    await activityAfter(() => requestCash({ actorId: ana, dealId, now: when }), when);
    when = at();
    await activityAfter(() => answerCash({ actorId: seller, dealId, agree: true, now: when }), when);
    when = at();
    await activityAfter(() => giveCash({ actorId: ana, dealId, now: when }), when);
    when = at();
    await activityAfter(() => rejectCash({ actorId: seller, dealId, now: when }), when);
    when = at();
    await activityAfter(() => giveCash({ actorId: ana, dealId, now: when }), when);
    when = at();
    await activityAfter(() => receiveCash({ actorId: seller, dealId, now: when }), when);
    when = at();
    await activityAfter(() => confirmHandover({ actorId: ana, dealId, now: when }), when);
    when = at();
    await activityAfter(() => confirmHandover({ actorId: seller, dealId, now: when }), when);
    expect((await dealRow(dealId)).status).toBe("completed");
  });

  it("is moved by accepting, cancelling, reporting and expiring, and a repeated step does not move it", async () => {
    const accepted = await reserved(ana, await newPost());
    expect(Date.now() - (await dealRow(accepted.dealId)).activityAt.getTime()).toBeLessThan(60_000);

    const cancelAt = new Date(Date.now() + 5_000);
    await cancelDeal({ actorId: ana, dealId: accepted.dealId, now: cancelAt });
    expect((await dealRow(accepted.dealId)).activityAt).toEqual(cancelAt);

    const secured = await scheduled(await newPost({ cash: true }), ben);
    await requestCash({ actorId: ben, dealId: secured.dealId });
    await answerCash({ actorId: seller, dealId: secured.dealId, agree: true });
    const reportAt = new Date(Date.now() + 6_000);
    await reportDeal({ actorId: ben, dealId: secured.dealId, input: { fault: "theirs", reason: "no_show", details: "" }, now: reportAt });
    expect((await dealRow(secured.dealId)).activityAt).toEqual(reportAt);
    const secondAt = new Date(Date.now() + 7_000);
    await reportDeal({ actorId: seller, dealId: secured.dealId, input: { fault: "unsure", reason: "other", details: "" }, now: secondAt });
    expect((await dealRow(secured.dealId)).activityAt).toEqual(secondAt);

    const idle = await reserved(ana, await newPost());
    await db.update(deal).set({ createdAt: new Date(Date.now() - 8 * DAY) }).where(eq(deal.id, idle.dealId));
    const expireAt = new Date(Date.now() + 8_000);
    await expireDeals(expireAt);
    expect(await dealRow(idle.dealId)).toMatchObject({ status: "cancelled", activityAt: expireAt });

    const paid = await scheduled(await newPost({ cash: false, online: true }), ben);
    await askToPay({ actorId: seller, dealId: paid.dealId });
    await markPaid({ actorId: ben, dealId: paid.dealId });
    const stamped = (await dealRow(paid.dealId)).activityAt;
    expect(await markPaid({ actorId: ben, dealId: paid.dealId, now: new Date(Date.now() + 60_000) })).toMatchObject({ ok: true });
    expect((await dealRow(paid.dealId)).activityAt).toEqual(stamped);
  });
});

describe("the reservations pinned at the bottom of a thread", () => {
  const pinnedIds = async (viewer: string, conversationId: string) => (await getConversation(viewer, conversationId))?.pinned.map((o) => o.deal.id);

  it("are the ones being carried out, the most recently active last", async () => {
    const one = await scheduled(await newPost({ cash: true, online: true }));
    const two = await reserved(ana, await newPost());
    expect(one.conversationId).toBe(two.conversationId);
    // Two's offer message is newer, but One had the last activity: it comes last.
    await db.update(deal).set({ activityAt: new Date(Date.now() - 2 * HOUR) }).where(eq(deal.id, two.dealId));
    await db.update(deal).set({ activityAt: new Date(Date.now() - 3 * HOUR) }).where(eq(deal.id, one.dealId));
    expect(await pinnedIds(ana, one.conversationId)).toEqual([one.dealId, two.dealId]);
    await askToPay({ actorId: seller, dealId: one.dealId, input: { method: "online" } });
    expect(await pinnedIds(seller, one.conversationId)).toEqual([two.dealId, one.dealId]);

    const view = await getConversation(ana, one.conversationId);
    expect(view?.pinned.map((o) => o.deal.activityAt.getTime())).toEqual([...(view?.pinned.map((o) => o.deal.activityAt.getTime()) ?? [])].sort((a, b) => a - b));
    expect(view?.pinned[1]).toMatchObject({ post: { title: expect.stringContaining("Handshake post") }, deal: { status: "scheduled", payment: { stage: "asked" } } });
    // The messages are not reordered by this.
    expect(view?.messages.map((m) => m.id)).toEqual([...(view?.messages.map((m) => m.id) ?? [])].sort((a, b) => a - b));
  });

  it("are only the ones being carried out: finished, cancelled and reported ones stay at their offer", async () => {
    const done = await scheduled(await newPost({ free: true }));
    await bothConfirm(done.dealId);
    const cancelled = await reserved(ana, await newPost());
    await cancelDeal({ actorId: ana, dealId: cancelled.dealId });
    const reported = await scheduled(await newPost({ free: true }));
    await confirmHandover({ actorId: ana, dealId: reported.dealId, now: after });
    await reportDeal({ actorId: seller, dealId: reported.dealId, input: { fault: "unsure", reason: "other", details: "" } });
    const open = await reserved(ana, await newPost());
    const active = await scheduled(await newPost({ free: true }));

    expect((await pinnedIds(ana, done.conversationId))?.sort()).toEqual([open.dealId, active.dealId].sort());
  });
});

describe("the time and place shown under a notification", () => {
  const detailsFor = async (id: string) => (await db.select({ type: notification.type, detail: notification.detail }).from(notification).where(eq(notification.recipientId, id)));

  it("is the proposed one for a proposal and the agreed one for the rest, and nothing before there is a time", async () => {
    const { dealId } = await reserved(ana, await newPost({ cash: true }));
    await clearNotices();
    expect(await cancelDeal({ actorId: seller, dealId })).toMatchObject({ ok: true });
    expect(await detailsFor(ana)).toEqual([{ type: "deal_cancelled", detail: null }]);
    await clearNotices();

    const next = await reserved(ana, await newPost({ cash: true }));
    await clearNotices();
    await proposeHandover({ actorId: ana, dealId: next.dealId, input: proposal(first, "Gate 2") });
    const proposed = noticeDetail({ scheduledAt: null, place: null, proposedAt: first.at, proposedPlace: "Gate 2" }, "deal_proposed");
    expect(proposed).toContain("Gate 2");
    expect(await detailsFor(seller)).toEqual([{ type: "deal_proposed", detail: proposed }]);
    await answerProposal({ actorId: seller, dealId: next.dealId, agree: true });
    expect(await detailsFor(ana)).toEqual([{ type: "deal_scheduled", detail: proposed }]);
    await clearNotices();
    expect(await cancelDeal({ actorId: ana, dealId: next.dealId })).toMatchObject({ ok: true });
    expect(await detailsFor(seller)).toEqual([{ type: "deal_cancelled", detail: proposed }]);
  });

  it("tells the one who proposed when the other declines it", async () => {
    const { dealId } = await reserved(ana, await newPost({ cash: true }));
    expect(await proposeHandover({ actorId: ana, dealId, input: proposal() })).toMatchObject({ ok: true });
    await clearNotices();
    expect(await answerProposal({ actorId: seller, dealId, agree: false })).toMatchObject({ ok: true });
    expect(await noticesFor(ana)).toEqual(["deal_proposal_declined"]);
    expect(await noticesFor(seller)).toEqual([]);
  });
});

describe.each(kinds)("$kind: saying the handover did not happen", ({ wishlist }) => {
  it("takes the other's confirmation back and tells them; only the one who has not confirmed can, and then both can confirm again", async () => {
    // The seller hands over a showcase item; on a Wishlist the supplier (Ana) hands it over to the poster (the seller).
    const hander = wishlist ? ana : seller;
    const receiver = wishlist ? seller : ana;
    const { dealId } = await scheduled(await newPost({ wishlist, free: true }));

    expect(await rejectHandover({ actorId: receiver, dealId })).toEqual({ ok: false, error: NOTHING_TO_DENY });
    await confirmHandover({ actorId: hander, dealId, now: after });
    await clearNotices();
    expect(await rejectHandover({ actorId: hander, dealId })).toEqual({ ok: false, error: ALREADY_SAID });

    expect(await rejectHandover({ actorId: receiver, dealId })).toMatchObject({ ok: true, completed: false });
    const row = await dealRow(dealId);
    expect(row.ownerConfirmedAt).toBeNull();
    expect(row.responderConfirmedAt).toBeNull();
    expect(row.status).toBe("scheduled");
    expect(await noticesFor(hander)).toEqual(["deal_handover_rejected"]);
    expect(await noticesFor(receiver)).toEqual([]);

    // Once it is true, both say so and it completes.
    await bothConfirm(dealId);
    expect((await dealRow(dealId)).status).toBe("completed");
    expect(await rejectHandover({ actorId: receiver, dealId })).toMatchObject({ ok: false });
  });
});
