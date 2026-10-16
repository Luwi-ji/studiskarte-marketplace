import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { conversation, deal, image, message, notification, offer, post, rateLimitEvent, student } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { declineOffer, makeOffer, OFFER_CLOSED, OFFER_NOT_FOUND, withdrawOffer } from "@/lib/deals/offers";
import { OFFER_DAYS, offerLabels, offerOptions, parseOffer, RESERVED_POST } from "@/lib/deals/rules";
import { getDb, getPool } from "@/lib/db";
import { expireOffers } from "@/lib/jobs/expire-offers";
import { CLOSED_POST } from "@/lib/messaging/rules";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `of-s-${run}`;
const ana = `of-a-${run}`;
const ben = `of-b-${run}`;
const cy = `of-c-${run}`;
const people = [seller, ana, ben, cy];
const DAY = 86_400_000;
let counter = 0;

type Price = { kind: "amount"; amount: number } | { kind: "free" } | { kind: "negotiable" };

async function newPost(price: Price = { kind: "amount", amount: 500 }, kind: "showcase" | "wishlist" = "showcase"): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind,
    title: `Offer post ${run} #${counter}`,
    description: "A post that takes offers.",
    categoryId: "other",
    condition: null,
    priceKind: price.kind,
    priceAmount: price.kind === "amount" ? String(price.amount) : "",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    deliveryArea: "",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

const offerInput = (amount: number | string, note = "") => ({ kind: "offer", amount: String(amount), note });
const reserveInput = (note = "") => ({ kind: "reserve", note });

async function offered(from: string, postId: string, amount = 400): Promise<{ offerId: string; conversationId: string }> {
  const result = await makeOffer({ responderId: from, postId, input: offerInput(amount) });
  if (!result.ok) throw new Error(result.error);
  return { offerId: result.offerId, conversationId: result.conversationId };
}

const statusOf = async (id: string) => (await db.select({ s: offer.status }).from(offer).where(eq(offer.id, id)))[0]?.s;
const postStatus = async (id: string) => (await db.select({ s: post.status }).from(post).where(eq(post.id, id)))[0]?.s;
const noticesFor = (id: string) => db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id));
const dealsOn = (postId: string) => db.select().from(deal).where(eq(deal.postId, postId));

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Buyer" });
  await createTestStudent(cy, { handle: `cy_${run}`, name: "Cy Buyer" });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

// A seller may have only 20 open posts, and each test makes its own.
afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(notification).where(inArray(notification.recipientId, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("what an offer may be", () => {
  it("takes a whole peso amount from 1 to 1,000,000 for an offer, and nothing for a reserve", () => {
    expect(parseOffer(offerInput(1))).toMatchObject({ ok: true, data: { kind: "offer", amount: 1 } });
    expect(parseOffer(offerInput("1000000"))).toMatchObject({ ok: true, data: { amount: 1_000_000 } });
    for (const bad of ["0", "-5", "1.5", "1e3", "", "abc", "1000001", "99999999"]) {
      expect(parseOffer(offerInput(bad))).toMatchObject({ ok: false, field: "amount" });
    }
    expect(parseOffer(reserveInput())).toEqual({ ok: true, data: { kind: "reserve", amount: null, note: null } });
    expect(parseOffer({ kind: "haggle" }).ok).toBe(false);
    expect(parseOffer(null).ok).toBe(false);
  });

  it("keeps a note up to 2,000 characters, trimmed", () => {
    expect(parseOffer(offerInput(100, "  hi  "))).toMatchObject({ data: { note: "hi" } });
    expect(parseOffer(offerInput(100, "x".repeat(2001)))).toMatchObject({ ok: false, field: "note" });
  });

  const base = { postStatus: "open", postExpiresAt: new Date(Date.now() + DAY), ownerStatus: "active", responderStatus: "active" };
  it("offers both on a priced post, only a reserve on a free one, only an offer on a negotiable one", () => {
    expect(offerOptions({ ...base, priceKind: "amount" })).toEqual({ offer: true, reserve: true, reason: null });
    expect(offerOptions({ ...base, priceKind: "free" })).toEqual({ offer: false, reserve: true, reason: null });
    expect(offerOptions({ ...base, priceKind: "negotiable" })).toEqual({ offer: true, reserve: false, reason: null });
  });

  it("offers nothing on a reserved, closed or expired post, or when someone is suspended", () => {
    expect(offerOptions({ ...base, priceKind: "amount", postStatus: "reserved" })).toMatchObject({ offer: false, reserve: false, reason: RESERVED_POST });
    for (const status of ["withdrawn", "expired", "fulfilled", "hidden", "removed"]) {
      expect(offerOptions({ ...base, priceKind: "amount", postStatus: status })).toMatchObject({ offer: false, reserve: false, reason: CLOSED_POST });
    }
    expect(offerOptions({ ...base, priceKind: "amount", postExpiresAt: new Date(Date.now() - 1000) }).reason).toBe(CLOSED_POST);
    expect(offerOptions({ ...base, priceKind: "amount", ownerStatus: "suspended" }).offer).toBe(false);
  });

  it("words the buttons for what the responder is doing", () => {
    expect(offerLabels("showcase")).toEqual({ offer: "Make offer", reserve: "Reserve" });
    expect(offerLabels("wishlist")).toEqual({ offer: "Offer a price", reserve: "Supply it" });
  });
});

describe("making an offer", () => {
  it("starts the conversation, shows the offer as a card with the note, and tells the owner", async () => {
    const postId = await newPost();
    const alerts: string[] = [];
    const before = Date.now();
    const result = await makeOffer({ responderId: ana, postId, input: offerInput(450, "Can you do 450?"), alert: (id) => void alerts.push(id) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [row] = await db.select().from(offer).where(eq(offer.id, result.offerId));
    expect(row).toMatchObject({ amount: 450, isReserve: false, status: "pending", decidedAt: null });
    expect(row.expiresAt.getTime() - before).toBeGreaterThan(OFFER_DAYS * DAY - 60_000);
    expect(row.expiresAt.getTime() - before).toBeLessThan(OFFER_DAYS * DAY + 60_000);

    const [card] = await db.select().from(message).where(eq(message.conversationId, result.conversationId));
    expect(card).toMatchObject({ offerId: result.offerId, senderId: ana, body: "Can you do 450?" });
    expect(await noticesFor(seller)).toEqual([{ type: "offer_received" }]);
    expect(alerts).toHaveLength(1);
    expect(await noticesFor(ana)).toEqual([]);
  });

  it("reserves at the asking price: a priced post at its price, a free post at 0", async () => {
    const priced = await newPost({ kind: "amount", amount: 725 });
    const free = await newPost({ kind: "free" });
    const a = await makeOffer({ responderId: ana, postId: priced, input: reserveInput() });
    const b = await makeOffer({ responderId: ana, postId: free, input: reserveInput() });
    if (!a.ok || !b.ok) throw new Error("reserve refused");
    expect(await db.select({ amount: offer.amount, isReserve: offer.isReserve }).from(offer).where(eq(offer.id, a.offerId))).toEqual([{ amount: 725, isReserve: true }]);
    expect(await db.select({ amount: offer.amount, isReserve: offer.isReserve }).from(offer).where(eq(offer.id, b.offerId))).toEqual([{ amount: 0, isReserve: true }]);
  });

  it("refuses a reserve on a negotiable post and an offer on a free one, leaving nothing behind", async () => {
    const negotiable = await newPost({ kind: "negotiable" });
    const free = await newPost({ kind: "free" });
    expect(await makeOffer({ responderId: ana, postId: negotiable, input: reserveInput() })).toMatchObject({ ok: false, error: expect.stringContaining("Make an offer") });
    expect(await makeOffer({ responderId: ana, postId: free, input: offerInput(100) })).toMatchObject({ ok: false, error: expect.stringContaining("free") });
    expect(await db.select().from(conversation).where(inArray(conversation.postId, [negotiable, free]))).toHaveLength(0);
    // An offer on a negotiable post is fine.
    expect((await makeOffer({ responderId: ana, postId: negotiable, input: offerInput(300) })).ok).toBe(true);
  });

  it("refuses an offer on your own post", async () => {
    const postId = await newPost();
    expect(await makeOffer({ responderId: seller, postId, input: offerInput(100) })).toEqual({ ok: false, error: "You can't make an offer on your own post." });
  });

  it("refuses an offer on a reserved, withdrawn or expired post, with a reason", async () => {
    const reserved = await newPost();
    await db.update(post).set({ status: "reserved" }).where(eq(post.id, reserved));
    expect(await makeOffer({ responderId: ana, postId: reserved, input: offerInput(100) })).toEqual({ ok: false, error: RESERVED_POST });

    const withdrawn = await newPost();
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, withdrawn));
    expect(await makeOffer({ responderId: ana, postId: withdrawn, input: offerInput(100) })).toEqual({ ok: false, error: CLOSED_POST });

    const lapsed = await newPost();
    await db.update(post).set({ expiresAt: sql`now() - interval '1 minute'`, listedAt: sql`now() - interval '31 days'` }).where(eq(post.id, lapsed));
    expect(await makeOffer({ responderId: ana, postId: lapsed, input: offerInput(100) })).toEqual({ ok: false, error: CLOSED_POST });
    expect(await db.select().from(conversation).where(inArray(conversation.postId, [reserved, withdrawn, lapsed]))).toHaveLength(0);
  });

  it("allows one pending offer per responder per post, and a new one after the old is withdrawn or declined", async () => {
    const postId = await newPost();
    const first = await offered(ana, postId);
    expect(await makeOffer({ responderId: ana, postId, input: offerInput(300) })).toMatchObject({ ok: false, error: expect.stringContaining("pending offer") });
    expect(await withdrawOffer({ responderId: ana, offerId: first.offerId })).toMatchObject({ ok: true });
    const second = await offered(ana, postId, 350);
    expect(await declineOffer({ ownerId: seller, offerId: second.offerId })).toMatchObject({ ok: true });
    expect((await makeOffer({ responderId: ana, postId, input: offerInput(360) })).ok).toBe(true);
    // Another responder is not blocked by Ana's.
    expect((await makeOffer({ responderId: ben, postId, input: offerInput(300) })).ok).toBe(true);
  });

  it("lets only one of two offers from the same responder at the same moment through", async () => {
    const postId = await newPost();
    const results = await Promise.all([1, 2, 3].map((n) => makeOffer({ responderId: ana, postId, input: offerInput(300 + n) })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.select().from(offer).innerJoin(conversation, eq(conversation.id, offer.conversationId)).where(and(eq(conversation.postId, postId), eq(offer.status, "pending")))).toHaveLength(1);
  });

  it("does not let an offer whose time has run out block a new one", async () => {
    const postId = await newPost();
    const old = await offered(ana, postId);
    await db.update(offer).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(offer.id, old.offerId));
    expect((await makeOffer({ responderId: ana, postId, input: offerInput(380) })).ok).toBe(true);
    expect(await statusOf(old.offerId)).toBe("expired");
  });
});

describe("accepting", () => {
  it("creates one deal, reserves the post, accepts the offer, and declines every other pending offer", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId, 450);
    const b = await offered(ben, postId, 400);
    const c = await offered(cy, postId, 380);
    await db.delete(notification).where(inArray(notification.recipientId, people));
    const alerts: string[] = [];

    expect(await acceptOffer({ ownerId: seller, offerId: b.offerId, alert: (id) => void alerts.push(id) })).toEqual({ ok: true, conversationId: b.conversationId });

    expect(await postStatus(postId)).toBe("reserved");
    expect(await statusOf(b.offerId)).toBe("accepted");
    expect(await statusOf(a.offerId)).toBe("declined");
    expect(await statusOf(c.offerId)).toBe("declined");
    const deals = await dealsOn(postId);
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ ownerId: seller, responderId: ben, amount: 400, status: "agreed", offerId: b.offerId });

    expect(await noticesFor(ben)).toEqual([{ type: "offer_accepted" }]);
    expect(await noticesFor(ana)).toEqual([{ type: "offer_declined" }]);
    expect(await noticesFor(cy)).toEqual([{ type: "offer_declined" }]);
    expect(await noticesFor(seller)).toEqual([]);
    expect(alerts).toHaveLength(3);
  });

  it("leaves exactly one deal and one declined offer when two are accepted at the same moment", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId, 450);
    const b = await offered(ben, postId, 400);

    const results = await Promise.all([acceptOffer({ ownerId: seller, offerId: a.offerId }), acceptOffer({ ownerId: seller, offerId: b.offerId })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
    expect(await dealsOn(postId)).toHaveLength(1);
    const statuses = [await statusOf(a.offerId), await statusOf(b.offerId)].sort();
    expect(statuses).toEqual(["accepted", "declined"]);
    expect(await postStatus(postId)).toBe("reserved");
  });

  it("is refused for anyone but the post's owner, with the same answer as for a missing offer", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    const stranger = await acceptOffer({ ownerId: ben, offerId: a.offerId });
    const responder = await acceptOffer({ ownerId: ana, offerId: a.offerId });
    const missing = await acceptOffer({ ownerId: seller, offerId: randomUUID() });
    expect(stranger).toEqual({ ok: false, error: OFFER_NOT_FOUND });
    expect(responder).toEqual(stranger);
    expect(missing).toEqual(stranger);
    expect(await statusOf(a.offerId)).toBe("pending");
    expect(await dealsOn(postId)).toHaveLength(0);
  });

  it("is refused for an offer that is withdrawn, declined or already accepted", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    const b = await offered(ben, postId);
    await withdrawOffer({ responderId: ana, offerId: a.offerId });
    await declineOffer({ ownerId: seller, offerId: b.offerId });
    expect(await acceptOffer({ ownerId: seller, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_CLOSED });
    expect(await acceptOffer({ ownerId: seller, offerId: b.offerId })).toEqual({ ok: false, error: OFFER_CLOSED });
    const c = await offered(cy, postId);
    expect((await acceptOffer({ ownerId: seller, offerId: c.offerId })).ok).toBe(true);
    expect(await acceptOffer({ ownerId: seller, offerId: c.offerId })).toEqual({ ok: false, error: OFFER_CLOSED });
    expect(await dealsOn(postId)).toHaveLength(1);
  });

  it("is refused once the offer's time has run out, and the offer is marked expired", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    await db.update(offer).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(offer.id, a.offerId));
    expect(await acceptOffer({ ownerId: seller, offerId: a.offerId })).toEqual({ ok: false, error: "This offer has expired." });
    expect(await statusOf(a.offerId)).toBe("expired");
    expect(await postStatus(postId)).toBe("open");
  });

  it("is refused when the post was withdrawn or expired in the meantime", async () => {
    const withdrawn = await newPost();
    const a = await offered(ana, withdrawn);
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, withdrawn));
    expect(await acceptOffer({ ownerId: seller, offerId: a.offerId })).toEqual({ ok: false, error: CLOSED_POST });

    const lapsed = await newPost();
    const b = await offered(ben, lapsed);
    await db.update(post).set({ expiresAt: sql`now() - interval '1 minute'`, listedAt: sql`now() - interval '31 days'` }).where(eq(post.id, lapsed));
    expect(await acceptOffer({ ownerId: seller, offerId: b.offerId })).toEqual({ ok: false, error: CLOSED_POST });
    expect(await dealsOn(withdrawn)).toHaveLength(0);
    expect(await dealsOn(lapsed)).toHaveLength(0);
  });

  it("takes no new offer once the post is reserved", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await makeOffer({ responderId: ben, postId, input: offerInput(100) })).toEqual({ ok: false, error: RESERVED_POST });
    expect(await makeOffer({ responderId: cy, postId, input: reserveInput() })).toEqual({ ok: false, error: RESERVED_POST });
  });

  it("keeps the amount an offer was made at when the owner later changes the price", async () => {
    const postId = await newPost({ kind: "amount", amount: 500 });
    const a = await offered(ana, postId, 450);
    await db.update(post).set({ priceAmount: 900 }).where(eq(post.id, postId));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect((await dealsOn(postId))[0].amount).toBe(450);
  });
});

describe("declining and withdrawing", () => {
  it("lets only the owner decline and only the responder withdraw, each only while pending", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    expect(await declineOffer({ ownerId: ben, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_NOT_FOUND });
    expect(await declineOffer({ ownerId: ana, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_NOT_FOUND });
    expect(await withdrawOffer({ responderId: seller, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_NOT_FOUND });
    expect(await withdrawOffer({ responderId: ben, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_NOT_FOUND });
    expect(await statusOf(a.offerId)).toBe("pending");

    expect(await declineOffer({ ownerId: seller, offerId: a.offerId })).toMatchObject({ ok: true });
    expect(await declineOffer({ ownerId: seller, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_CLOSED });
    expect(await withdrawOffer({ responderId: ana, offerId: a.offerId })).toEqual({ ok: false, error: OFFER_CLOSED });
    expect(await noticesFor(ana)).toEqual([{ type: "offer_declined" }]);
  });
});

describe("expiry", () => {
  it("expires offers whose time ran out and tells the responder once; a second run changes nothing", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    const b = await offered(ben, postId);
    await db.update(offer).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(offer.id, a.offerId));
    const alerts: string[] = [];
    expect(await expireOffers(new Date(), (id) => void alerts.push(id))).toBeGreaterThanOrEqual(1);
    expect(await expireOffers()).toBe(0);
    expect(await statusOf(a.offerId)).toBe("expired");
    expect(await statusOf(b.offerId)).toBe("pending");
    expect(await noticesFor(ana)).toEqual([{ type: "offer_expired" }]);
    expect(await noticesFor(ben)).toEqual([]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it("expires pending offers when the post expires, and they stay expired after a relist", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    await db.update(post).set({ status: "expired" }).where(eq(post.id, postId));
    await expireOffers();
    expect(await statusOf(a.offerId)).toBe("expired");
    await db.update(post).set({ status: "open", listedAt: sql`now()`, expiresAt: sql`now() + interval '30 days'` }).where(eq(post.id, postId));
    await expireOffers();
    expect(await statusOf(a.offerId)).toBe("expired");
    expect((await makeOffer({ responderId: ana, postId, input: offerInput(420) })).ok).toBe(true);
  });
});

describe("rules the database keeps", () => {
  it("refuses a second pending offer in one conversation, and amounts out of range", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    const expiresAt = new Date(Date.now() + DAY);
    await expect(db.insert(offer).values({ conversationId: a.conversationId, amount: 10, expiresAt })).rejects.toMatchObject({ cause: { code: "23505" } });
    await db.update(offer).set({ status: "withdrawn", decidedAt: new Date() }).where(eq(offer.id, a.offerId));
    await expect(db.insert(offer).values({ conversationId: a.conversationId, amount: 0, isReserve: false, expiresAt })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(offer).values({ conversationId: a.conversationId, amount: 1_000_001, expiresAt })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(offer).values({ conversationId: a.conversationId, amount: 5, status: "accepted", expiresAt })).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("allows only one active deal per post, between the owner and the offer's responder", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    const b = await offered(ben, postId);
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    await expect(db.insert(deal).values({ postId, offerId: b.offerId, ownerId: seller, responderId: ben, amount: 1 })).rejects.toMatchObject({ cause: { code: "23505" } });
    // Cancelled deals do not count: a new one is then allowed (the hand-back of a cancelled deal is Phase 11).
    await db.update(deal).set({ status: "cancelled" }).where(eq(deal.postId, postId));
    await expect(db.insert(deal).values({ postId, offerId: b.offerId, ownerId: seller, responderId: ana, amount: 1 })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(deal).values({ postId, offerId: b.offerId, ownerId: ben, responderId: ben, amount: 1 })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(deal).values({ postId, offerId: b.offerId, ownerId: seller, responderId: ben, amount: 1 })).resolves.toBeDefined();
  });

  it("refuses an offer card written by the owner, or in someone else's conversation", async () => {
    const postId = await newPost();
    const a = await offered(ana, postId);
    const b = await offered(ben, postId);
    await db.update(offer).set({ status: "withdrawn", decidedAt: new Date() }).where(eq(offer.id, a.offerId));
    const [fresh] = await db.insert(offer).values({ conversationId: a.conversationId, amount: 77, expiresAt: new Date(Date.now() + DAY) }).returning({ id: offer.id });
    await expect(db.insert(message).values({ conversationId: a.conversationId, senderId: seller, offerId: fresh.id })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(message).values({ conversationId: b.conversationId, senderId: ben, offerId: fresh.id })).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.insert(message).values({ conversationId: a.conversationId, senderId: ana, offerId: fresh.id })).resolves.toBeDefined();
    // A message with no text, picture or offer is still refused.
    await expect(db.insert(message).values({ conversationId: a.conversationId, senderId: ana, body: null })).rejects.toMatchObject({ cause: { code: "23514" } });
  });
});

describe("students", () => {
  it("never lets a suspended student make or accept an offer", async () => {
    const postId = await newPost();
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ana));
    try {
      expect(await makeOffer({ responderId: ana, postId, input: offerInput(100) })).toMatchObject({ ok: false });
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, ana));
    }
    const a = await offered(ana, postId);
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ana));
    try {
      expect(await acceptOffer({ ownerId: seller, offerId: a.offerId })).toMatchObject({ ok: false });
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, ana));
    }
    expect(await dealsOn(postId)).toHaveLength(0);
  });
});
