import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal } from "@/lib/deals/cancel";
import { confirmHandover, NOT_SCHEDULED } from "@/lib/deals/confirm";
import { answerCash, requestCash } from "@/lib/deals/payment";
import { chooseableDays, parseProposal, suggestTime, time12, to24h } from "@/lib/deals/handover";
import { makeOffer } from "@/lib/deals/offers";
import { answerProposal, NO_PROPOSAL, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { expireDeals } from "@/lib/jobs/expire-deals";
import { sendHandoverReminders } from "@/lib/jobs/reminders";
import { getConversation } from "@/lib/messaging/read";
import { createPost } from "@/lib/posts/create";
import type { Availability, NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `ho-s-${run}`;
const ana = `ho-a-${run}`;
const ben = `ho-b-${run}`;
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
    deliveryArea: delivery ? "Campus" : "",
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

/** Cash in person is agreed, and both confirm the handover: the deal completes. */
async function finish(dealId: string, buyer = ana, now = new Date(slot.at.getTime() + HOUR)) {
  await requestCash({ actorId: buyer, dealId });
  await answerCash({ actorId: seller, dealId, agree: true });
  await confirmHandover({ actorId: buyer, dealId, now });
  await confirmHandover({ actorId: seller, dealId, now });
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

describe("what a proposal may be", () => {
  const windows: Availability[] = [
    { kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" },
    { kind: "date", date: "2030-01-15", startTime: "13:00", endTime: "14:00" },
  ];
  const post_ = { methods: ["meetup" as const], windows };
  const now = new Date("2030-01-01T00:00:00Z");

  it("takes a method the post offers, a future Philippine time inside its availability, and a place", () => {
    // 2030-01-07 is a Monday.
    expect(parseProposal({ method: "meetup", date: "2030-01-07", time: "09:30", place: " Gate " }, post_, now)).toEqual({
      ok: true,
      data: { method: "meetup", at: new Date("2030-01-07T09:30:00+08:00"), place: "Gate" },
    });
    // A one-off date window counts too, and the ends of a window are inside it.
    expect(parseProposal({ method: "meetup", date: "2030-01-15", time: "13:00", place: "Gate" }, post_, now).ok).toBe(true);
    expect(parseProposal({ method: "meetup", date: "2030-01-07", time: "10:00", place: "Gate" }, post_, now).ok).toBe(true);
  });

  it("refuses other methods, other days or hours, the past, too far ahead, and a missing or long place", () => {
    const bad = (extra: Record<string, unknown>) => parseProposal({ method: "meetup", date: "2030-01-07", time: "09:30", place: "Gate", ...extra }, post_, now);
    expect(bad({ method: "delivery" })).toMatchObject({ ok: false, field: "method" });
    expect(bad({ date: "2030-01-08" })).toMatchObject({ ok: false, field: "time" }); // a Tuesday
    expect(bad({ time: "10:30" })).toMatchObject({ ok: false, field: "time" });
    expect(bad({ date: "2029-12-31", time: "09:30" })).toMatchObject({ ok: false, field: "time" });
    expect(bad({ date: "2030-06-03" })).toMatchObject({ ok: false, field: "date" }); // a Monday, 5 months on
    expect(bad({ date: "2030-02-31" })).toMatchObject({ ok: false, field: "date" });
    expect(bad({ time: "9:30" })).toMatchObject({ ok: false, field: "time" });
    expect(bad({ place: "   " })).toMatchObject({ ok: false, field: "place" });
    expect(bad({ place: "x".repeat(201) })).toMatchObject({ ok: false, field: "place" });
    expect(parseProposal(null, post_, now).ok).toBe(false);
  });
});

describe("choosing a day and a time", () => {
  const windows: Availability[] = [
    { kind: "weekly", weekday: 1, startTime: "09:00", endTime: "17:30" },
    { kind: "date", date: "2030-01-10", startTime: "13:00", endTime: "14:00" },
  ];
  const now = new Date("2030-01-01T00:00:00Z"); // 8:00 AM in the Philippines

  it("reads times on the 12-hour clock, and writes them back on the 24-hour clock", () => {
    expect([time12("00:00"), time12("09:05"), time12("12:00"), time12("13:30"), time12("23:59")]).toEqual(["12:00 AM", "9:05 AM", "12:00 PM", "1:30 PM", "11:59 PM"]);
    expect([to24h(12, 0, false), to24h(9, 5, false), to24h(12, 0, true), to24h(1, 30, true), to24h(11, 55, true)]).toEqual(["00:00", "09:05", "12:00", "13:30", "23:55"]);
  });

  it("offers only the days the post is available, within 60 days, and every day to the owner", () => {
    const days = chooseableDays(windows, now).map((d) => d.date);
    expect(days).toContain("2030-01-07"); // a Monday
    expect(days).toContain("2030-01-10"); // the one-off date
    expect(days).not.toContain("2030-01-08"); // a Tuesday
    expect(days.every((d) => d <= "2030-03-02")).toBe(true);
    expect(chooseableDays(null, now)).toHaveLength(61);
    expect(chooseableDays(windows, now)[0]).toMatchObject({ date: "2030-01-07", label: "Mon, Jan 7" });
    expect(chooseableDays(null, now)[0]).toMatchObject({ date: "2030-01-01", label: "Tue, Jan 1" });
    // The Philippine date, not the machine's: 16:30 UTC is already the next day in Manila.
    expect(chooseableDays(null, new Date("2030-01-01T16:30:00Z"))[0].date).toBe("2030-01-02");
  });

  it("starts the form at a time that is not in the past: the window's start, or the next hour if today's has passed", () => {
    const monday = "2030-01-07";
    // The owner has no window: 9:00 AM on a later day, the next full hour today once 9:00 has passed.
    expect(suggestTime("2030-01-08", null, now)).toBe("09:00");
    expect(suggestTime("2030-01-01", null, now)).toBe("09:00"); // today, 8:00 AM: 9:00 is still ahead
    expect(suggestTime("2030-01-01", null, new Date("2030-01-01T08:42:00Z"))).toBe("17:00"); // 4:42 PM
    // A buyer starts at the window's start on that day, or the next hour when it has begun today.
    expect(suggestTime(monday, windows, now)).toBe("09:00");
    expect(suggestTime("2030-01-10", windows, now)).toBe("13:00");
    expect(suggestTime(monday, windows, new Date("2030-01-07T01:20:00Z"))).toBe("10:00"); // 9:20 AM on the Monday itself
    // Late at night there is no next hour today: the start is kept and the server says why it is refused.
    expect(suggestTime("2030-01-01", null, new Date("2030-01-01T15:30:00Z"))).toBe("09:00");
  });

  it("lets the owner propose any time, but not a buyer", () => {
    const outside = { method: "meetup", date: "2030-01-08", time: "07:00", place: "Gate" };
    const post_ = { methods: ["meetup" as const], windows };
    expect(parseProposal(outside, post_, now)).toMatchObject({ ok: false, field: "time" });
    expect(parseProposal(outside, { ...post_, windows: null }, now).ok).toBe(true);
    // The owner still cannot propose the past.
    expect(parseProposal({ ...outside, date: "2029-12-31" }, { ...post_, windows: null }, now)).toMatchObject({ ok: false, field: "time" });
  });
});

describe("agreeing a time and place", () => {
  it("lets the owner propose a time outside the post's availability, such as an early handover", async () => {
    const { dealId } = await reserved(ana, await newPost());
    // The post is available Mondays 9:00 to 10:00 AM; this is a Monday evening.
    expect(await proposeHandover({ actorId: seller, dealId, input: proposal({ time: "18:00" }) })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ proposedBy: seller });
    expect(await answerProposal({ actorId: ana, dealId, agree: true })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ status: "scheduled" });
    // The buyer cannot go outside it.
    const other = await reserved(ben, await newPost());
    expect(await proposeHandover({ actorId: ben, dealId: other.dealId, input: proposal({ time: "18:00" }) })).toMatchObject({ ok: false, field: "time" });
  });

  it("is proposed by one, agreed by the other, and then scheduled for both", async () => {
    const postId = await newPost();
    const { dealId, conversationId } = await reserved(ana, postId);
    await db.delete(notification).where(inArray(notification.recipientId, people));
    const alerts: string[] = [];

    expect(await proposeHandover({ actorId: ana, dealId, input: proposal(), alert: (id) => void alerts.push(id) })).toEqual({ ok: true, conversationId });
    let row = await dealRow(dealId);
    expect(row).toMatchObject({ status: "agreed", proposedBy: ana, proposedMethod: "meetup", proposedPlace: "Library steps", handoverMethod: null });
    expect(await noticesFor(seller)).toEqual(["deal_proposed"]);
    expect(await noticesFor(ana)).toEqual([]);
    expect(alerts).toHaveLength(1);

    // Each side sees it from their own side.
    expect((await getConversation(seller, conversationId))?.messages[0].offer?.deal?.proposal).toMatchObject({ byMe: false, place: "Library steps" });
    expect((await getConversation(ana, conversationId))?.messages[0].offer?.deal?.proposal).toMatchObject({ byMe: true });

    // The one who proposed cannot agree to their own proposal.
    expect(await answerProposal({ actorId: ana, dealId, agree: true })).toEqual({ ok: false, error: NO_PROPOSAL });
    expect(await answerProposal({ actorId: seller, dealId, agree: true })).toEqual({ ok: true, conversationId });
    row = await dealRow(dealId);
    expect(row).toMatchObject({ status: "scheduled", handoverMethod: "meetup", place: "Library steps", proposedBy: null, proposedAt: null });
    expect(row.scheduledAt?.getTime()).toBe(slot.at.getTime());
    expect(await noticesFor(ana)).toEqual(["deal_scheduled"]);
    expect(await answerProposal({ actorId: seller, dealId, agree: true })).toEqual({ ok: false, error: NO_PROPOSAL });
  });

  it("lets the other decline, and a newer proposal replaces an older one", async () => {
    const { dealId } = await reserved(ana, await newPost());
    await proposeHandover({ actorId: ana, dealId, input: proposal() });
    expect(await answerProposal({ actorId: seller, dealId, agree: false })).toMatchObject({ ok: true });
    expect(await dealRow(dealId)).toMatchObject({ status: "agreed", proposedBy: null });
    await proposeHandover({ actorId: ana, dealId, input: proposal({ place: "First" }) });
    await proposeHandover({ actorId: seller, dealId, input: proposal({ place: "Second" }) });
    expect(await dealRow(dealId)).toMatchObject({ proposedBy: seller, proposedPlace: "Second" });
  });

  it("is only for the two people, and only while the reservation is active", async () => {
    const { dealId } = await reserved(ana, await newPost());
    expect(await proposeHandover({ actorId: ben, dealId, input: proposal() })).toMatchObject({ ok: false });
    expect(await proposeHandover({ actorId: ana, dealId: randomUUID(), input: proposal() })).toMatchObject({ ok: false });
    expect(await answerProposal({ actorId: ben, dealId, agree: true })).toMatchObject({ ok: false });
    expect(await confirmHandover({ actorId: ben, dealId })).toMatchObject({ ok: false });
    await cancelDeal({ actorId: ana, dealId });
    expect(await proposeHandover({ actorId: ana, dealId, input: proposal() })).toMatchObject({ ok: false });
    expect((await dealRow(dealId)).proposedBy).toBeNull();
  });

  it("refuses a method the post does not offer, and a time outside its availability, leaving nothing behind", async () => {
    const { dealId } = await reserved(ana, await newPost({ meetup: true, delivery: false }));
    expect(await proposeHandover({ actorId: ana, dealId, input: proposal({ method: "delivery" }) })).toMatchObject({ ok: false, field: "method" });
    expect(await proposeHandover({ actorId: ana, dealId, input: proposal({ time: "15:00" }) })).toMatchObject({ ok: false, field: "time" });
    expect((await dealRow(dealId)).proposedBy).toBeNull();
    expect(await noticesFor(seller)).not.toContain("deal_proposed");
  });

  it("refuses to agree to a time that has already passed", async () => {
    const { dealId } = await reserved(ana, await newPost());
    await proposeHandover({ actorId: ana, dealId, input: proposal() });
    const late = await answerProposal({ actorId: seller, dealId, agree: true, now: new Date(slot.at.getTime() + HOUR) });
    expect(late).toMatchObject({ ok: false, error: expect.stringContaining("passed") });
    expect(await dealRow(dealId)).toMatchObject({ status: "agreed", proposedBy: null });
  });

  it("clears an earlier confirmation when the handover is rescheduled", async () => {
    const { dealId } = await scheduled();
    expect(await confirmHandover({ actorId: ana, dealId, now: new Date(slot.at.getTime() + HOUR) })).toMatchObject({ ok: true, completed: false });
    expect((await dealRow(dealId)).responderConfirmedAt).not.toBeNull();
    await proposeHandover({ actorId: seller, dealId, input: proposal({ place: "Cafeteria" }) });
    await answerProposal({ actorId: ana, dealId, agree: true });
    expect(await dealRow(dealId)).toMatchObject({ status: "scheduled", place: "Cafeteria", ownerConfirmedAt: null, responderConfirmedAt: null });
  });
});

describe("confirming the handover", () => {
  it("completes only when both confirm (before the agreed time too, once a slot is agreed), and fulfils the post", async () => {
    const { postId, dealId, conversationId } = await scheduled();
    const unscheduled = await reserved(ben, await newPost());
    await db.delete(notification).where(inArray(notification.recipientId, people));
    const after = new Date(slot.at.getTime() + HOUR);

    // Not before the time, and not before it is scheduled.
    // Confirming is allowed before the agreed time too: they may meet earlier, or elsewhere.
    expect(await confirmHandover({ actorId: ana, dealId })).toMatchObject({ ok: true, completed: false });
    expect(await confirmHandover({ actorId: ben, dealId: unscheduled.dealId, now: after })).toEqual({ ok: false, error: NOT_SCHEDULED });

    expect(await confirmHandover({ actorId: ana, dealId, now: after })).toEqual({ ok: true, conversationId, completed: false });
    expect(await dealRow(dealId)).toMatchObject({ status: "scheduled" });
    expect(await postStatus(postId)).toBe("reserved");
    expect(await noticesFor(seller)).toEqual(["deal_confirmed"]);
    // Saying it twice changes nothing and tells nobody twice.
    expect(await confirmHandover({ actorId: ana, dealId, now: after })).toMatchObject({ ok: true, completed: false });
    expect(await noticesFor(seller)).toEqual(["deal_confirmed"]);

    const viewed = (await getConversation(seller, conversationId))?.messages[0].offer?.deal;
    expect(viewed).toMatchObject({ status: "scheduled", confirmedByMe: false, confirmedByOther: true });

    // Both have confirmed the handover, but nothing is paid or agreed for the money: not complete yet.
    expect(await confirmHandover({ actorId: seller, dealId, now: after })).toEqual({ ok: true, conversationId, completed: false });
    expect(await dealRow(dealId)).toMatchObject({ status: "scheduled" });
    expect(await requestCash({ actorId: ana, dealId })).toMatchObject({ ok: true });
    expect(await answerCash({ actorId: seller, dealId, agree: true })).toMatchObject({ ok: true, completed: true });
    expect(await dealRow(dealId)).toMatchObject({ status: "completed" });
    expect(await postStatus(postId)).toBe("fulfilled");
    expect(await noticesFor(ana)).toEqual(["deal_completed", "deal_confirmed"]);
    // Completed is final.
    expect(await confirmHandover({ actorId: seller, dealId, now: after })).toMatchObject({ ok: false });
    expect(await cancelDeal({ actorId: seller, dealId })).toMatchObject({ ok: false });
  });

  it("leaves the post open for the rest when only some units were handed over", async () => {
    const postId = await newPost({ quantity: "2" });
    const a = await scheduled(ana, postId);
    await scheduled(ben, postId);
    const after = new Date(slot.at.getTime() + HOUR);
    await finish(a.dealId, ana, after);
    expect((await dealRow(a.dealId)).status).toBe("completed");
    // One unit is still being arranged, so the post is not fulfilled.
    expect(await postStatus(postId)).toBe("reserved");
  });
});

describe("rules the database keeps", () => {
  it("lets a deal complete only from scheduled and only with both confirmations, and never leave a final state", async () => {
    const { dealId } = await scheduled();
    const plain = await reserved(ben, await newPost());
    await expect(db.update(deal).set({ status: "completed" }).where(eq(deal.id, plain.dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ status: "completed", ownerConfirmedAt: new Date() }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await db.update(deal).set({ status: "cancelled" }).where(eq(deal.id, dealId));
    await expect(db.update(deal).set({ status: "agreed" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ status: "completed" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("refuses a scheduled deal with no time or place, a half proposal, a confirmation without a schedule, and a method the post does not offer", async () => {
    const { dealId } = await reserved(ana, await newPost({ meetup: true, delivery: false }));
    await expect(db.update(deal).set({ status: "scheduled" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ proposedBy: ana }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ ownerConfirmedAt: new Date() }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(
      db.update(deal).set({ proposedBy: ana, proposedMethod: "delivery", proposedAt: slot.at, proposedPlace: "Home" }).where(eq(deal.id, dealId)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(deal).set({ handoverMethod: "delivery", scheduledAt: slot.at, place: "Home", status: "scheduled" }).where(eq(deal.id, dealId))).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});

describe("reservations nobody carried out", () => {
  it("cancels one not scheduled within 7 days, reopens the post, tells both once, and ignores fresh ones", async () => {
    const postId = await newPost();
    const idle = await reserved(ana, postId);
    const other = await reserved(ben, await newPost());
    await db.update(deal).set({ createdAt: new Date(Date.now() - 8 * DAY) }).where(eq(deal.id, idle.dealId));
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await postStatus(postId)).toBe("reserved");

    expect(await expireDeals()).toBeGreaterThanOrEqual(1);
    expect((await dealRow(idle.dealId)).status).toBe("cancelled");
    expect(await postStatus(postId)).toBe("open");
    expect((await db.select({ e: post.expiresAt }).from(post).where(eq(post.id, postId)))[0].e.getTime()).toBeGreaterThan(Date.now() + 6 * DAY);
    expect(await noticesFor(ana)).toEqual(["deal_expired"]);
    expect(await noticesFor(seller)).toEqual(["deal_expired"]);
    expect((await dealRow(other.dealId)).status).toBe("agreed");
    expect(await expireDeals()).toBe(0);
    expect(await noticesFor(ana)).toEqual(["deal_expired"]);
  });

  it("cancels a scheduled one 7 days after its time unless it was completed, and not before", async () => {
    const stale = await scheduled();
    const recent = await scheduled(ben);
    const done = await scheduled(ben, (await newPost()));
    const after = new Date(slot.at.getTime() + HOUR);
    await finish(done.dealId, ben, after);
    // Move the stale deal's time to 8 days ago, and the recent one to 6 days ago, keeping the rest valid.
    await db.update(deal).set({ scheduledAt: new Date(Date.now() - 8 * DAY) }).where(eq(deal.id, stale.dealId));
    await db.update(deal).set({ scheduledAt: new Date(Date.now() - 6 * DAY) }).where(eq(deal.id, recent.dealId));
    await db.update(deal).set({ scheduledAt: new Date(Date.now() - 9 * DAY) }).where(and(eq(deal.id, done.dealId)));

    await expireDeals();
    expect((await dealRow(stale.dealId)).status).toBe("cancelled");
    expect((await dealRow(recent.dealId)).status).toBe("scheduled");
    expect((await dealRow(done.dealId)).status).toBe("completed");
    expect(await postStatus(stale.postId)).toBe("open");
  });
});

describe("reminders", () => {
  it("reminds both a day and an hour before, once each, and again for a new time", async () => {
    const { dealId } = await scheduled();
    const before = (ms: number) => new Date(slot.at.getTime() - ms);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    expect(await sendHandoverReminders(before(2 * DAY))).toBe(0);
    expect(await sendHandoverReminders(before(23 * HOUR))).toBe(2);
    expect(await sendHandoverReminders(before(22 * HOUR))).toBe(0);
    expect(await noticesFor(ana)).toEqual(["deal_reminder"]);
    expect(await noticesFor(seller)).toEqual(["deal_reminder"]);
    expect(await sendHandoverReminders(before(30 * 60_000))).toBe(2);
    expect(await noticesFor(ana)).toEqual(["deal_reminder", "deal_reminder"]);
    expect(await sendHandoverReminders(before(10 * 60_000))).toBe(0);
    // After the time there is no "before" reminder.
    expect(await sendHandoverReminders(new Date(slot.at.getTime() + HOUR))).toBe(0);
    expect((await dealRow(dealId)).status).toBe("scheduled");
  });

  it("reminds only the one who has not confirmed, 1 and 3 days after, and nobody when neither has", async () => {
    const { dealId } = await scheduled();
    await db.delete(notification).where(inArray(notification.recipientId, people));
    const later = (days: number) => new Date(slot.at.getTime() + days * DAY + HOUR);

    // Nobody has confirmed: no reminder to confirm.
    expect(await sendHandoverReminders(later(1))).toBe(0);
    await confirmHandover({ actorId: seller, dealId, now: new Date(slot.at.getTime() + HOUR) });
    await db.delete(notification).where(inArray(notification.recipientId, people));
    expect(await sendHandoverReminders(later(0))).toBe(0);
    expect(await sendHandoverReminders(later(1))).toBe(1);
    expect(await sendHandoverReminders(later(1))).toBe(0);
    expect(await noticesFor(ana)).toEqual(["deal_confirm_reminder"]);
    expect(await noticesFor(seller)).toEqual([]);
    expect(await sendHandoverReminders(later(3))).toBe(1);
    expect(await noticesFor(ana)).toEqual(["deal_confirm_reminder", "deal_confirm_reminder"]);
  });
});
