import { randomUUID } from "node:crypto";
import { eq, inArray, or, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, offer, post, rateLimitEvent } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal, DEAL_CLOSED, DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { unitsLeft, unitsTaken } from "@/lib/deals/capacity";
import { declineOffer, makeOffer, withdrawOffer } from "@/lib/deals/offers";
import { HAS_RESERVATION, offerOptions, parseOffer, PENDING_OFFER, RESERVED_POST } from "@/lib/deals/rules";
import { getDb, getPool } from "@/lib/db";
import { expirePosts } from "@/lib/jobs/expire-posts";
import { getConversation } from "@/lib/messaging/read";
import { createPost } from "@/lib/posts/create";
import { getPostDetail } from "@/lib/posts/detail";
import { quantityLine } from "@/lib/posts/format";
import { listOwnPosts } from "@/lib/posts/mine";
import type { NewPostInput } from "@/lib/posts/schema";
import { withdrawPost } from "@/lib/posts/transitions";
import { getEditablePost, updatePost } from "@/lib/posts/update";
import type { ObjectStore } from "@/lib/images/store";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `qt-s-${run}`;
const ana = `qt-a-${run}`;
const ben = `qt-b-${run}`;
const cy = `qt-c-${run}`;
const dee = `qt-d-${run}`;
const people = [seller, ana, ben, cy, dee];
const DAY = 86_400_000;
let counter = 0;

const noStore: ObjectStore = { put: async () => {}, delete: async () => {}, signedUrl: async () => "" };

/** A post with `quantity` units (null: ongoing). */
async function newPost(quantity: number | null, kind: "showcase" | "wishlist" = "showcase", price = 100): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind,
    title: `Quantity post ${run} #${counter}`,
    description: "A post with several available.",
    categoryId: "other",
    condition: null,
    priceKind: "amount",
    priceAmount: String(price),
    quantity: String(quantity ?? 1),
    unlimited: quantity === null,
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

const reserve = (quantity: number) => ({ kind: "reserve", quantity: String(quantity), note: "" });
const bid = (amount: number, quantity = 1) => ({ kind: "offer", amount: String(amount), quantity: String(quantity), note: "" });

async function ask(from: string, postId: string, input: unknown): Promise<{ offerId: string; conversationId: string }> {
  const result = await makeOffer({ responderId: from, postId, input });
  if (!result.ok) throw new Error(result.error);
  return { offerId: result.offerId, conversationId: result.conversationId };
}

const postRow = async (id: string) => (await db.select().from(post).where(eq(post.id, id)))[0];
const statusOf = async (id: string) => (await postRow(id)).status;
const offerStatus = async (id: string) => (await db.select({ s: offer.status }).from(offer).where(eq(offer.id, id)))[0]?.s;
const dealOf = async (offerId: string) => (await db.select().from(deal).where(eq(deal.offerId, offerId)))[0];
const noticesFor = (id: string) => db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id));

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  for (const [id, name] of [[ana, "Ana"], [ben, "Ben"], [cy, "Cy"], [dee, "Dee"]] as const) {
    await createTestStudent(id, { handle: `${name.toLowerCase()}_${run}`, name: `${name} Buyer` });
  }
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

// A seller may have only 20 open posts, and each test makes its own.
afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  // Everyone deals with the seller, so each test starts without conversations.
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

describe("what a post says about how many", () => {
  it("counts units: none is ongoing, one needs no count, several read '2 of 5 reserved'", () => {
    expect(quantityLine("showcase", null, 0)).toBe("Ongoing, no limit");
    expect(quantityLine("showcase", null, 3)).toBe("3 reserved");
    expect(quantityLine("showcase", 1, 0)).toBeNull();
    expect(quantityLine("showcase", 5, 2)).toBe("2 of 5 reserved");
    expect(quantityLine("wishlist", 3, 1)).toBe("1 of 3 supplied");
    expect(unitsLeft(5, 2)).toBe(3);
    expect(unitsLeft(5, 9)).toBe(0);
    expect(unitsLeft(null, 99)).toBeNull();
  });

  it("limits an offer to what is left, and shuts it when nothing is, or the buyer already has a reservation", () => {
    const base = { priceKind: "amount", postStatus: "open", postExpiresAt: new Date(Date.now() + DAY), ownerStatus: "active", responderStatus: "active", hasActiveDeal: false, hasPendingOffer: false };
    expect(offerOptions({ ...base, unitsLeft: 3 })).toMatchObject({ offer: true, reserve: true, maxQuantity: 3 });
    expect(offerOptions({ ...base, unitsLeft: null })).toMatchObject({ maxQuantity: 1000 });
    expect(offerOptions({ ...base, unitsLeft: 0 })).toMatchObject({ offer: false, reserve: false, reason: RESERVED_POST });
    expect(offerOptions({ ...base, unitsLeft: 3, hasActiveDeal: true })).toMatchObject({ offer: false, reserve: false, reason: HAS_RESERVATION });
    expect(offerOptions({ ...base, unitsLeft: 3, hasPendingOffer: true })).toMatchObject({ offer: false, reserve: false, reason: PENDING_OFFER });
  });

  it("asks for a whole number of units from 1 to 1,000", () => {
    expect(parseOffer({ kind: "reserve", quantity: "3" })).toMatchObject({ ok: true, data: { quantity: 3 } });
    expect(parseOffer(bid(100, 7))).toMatchObject({ ok: true, data: { quantity: 7, amount: 100 } });
    for (const bad of ["0", "-1", "2.5", "1001", "", "x"]) {
      expect(parseOffer({ kind: "reserve", quantity: bad })).toMatchObject({ ok: false, field: "quantity" });
    }
  });
});

describe("several reservations on one listing", () => {
  it("keeps the post Active until the last unit is taken, then Fully reserved and declines the offers that are left", async () => {
    const postId = await newPost(5);
    const a = await ask(ana, postId, reserve(2));
    const b = await ask(ben, postId, reserve(2));
    const c = await ask(cy, postId, reserve(2));
    const d = await ask(dee, postId, reserve(1));
    await db.delete(notification).where(inArray(notification.recipientId, people));

    expect((await acceptOffer({ ownerId: seller, offerId: a.offerId })).ok).toBe(true);
    expect(await statusOf(postId)).toBe("open"); // 3 left
    expect(await unitsTaken(db, postId)).toBe(2);

    expect((await acceptOffer({ ownerId: seller, offerId: b.offerId })).ok).toBe(true);
    expect(await statusOf(postId)).toBe("open"); // 1 left
    // Others stay pending while there is still something left.
    expect(await offerStatus(c.offerId)).toBe("pending");
    expect(await offerStatus(d.offerId)).toBe("pending");

    // Cy asked for 2 but only 1 is left: refused, with how many.
    expect(await acceptOffer({ ownerId: seller, offerId: c.offerId })).toEqual({ ok: false, error: expect.stringContaining("Only 1 left") });
    expect(await offerStatus(c.offerId)).toBe("pending");

    expect((await acceptOffer({ ownerId: seller, offerId: d.offerId })).ok).toBe(true);
    expect(await statusOf(postId)).toBe("reserved"); // none left
    expect(await offerStatus(c.offerId)).toBe("declined"); // nothing left to ask for
    expect(await noticesFor(cy)).toEqual([{ type: "offer_declined" }]);
    expect(await noticesFor(ana)).toEqual([{ type: "offer_accepted" }]);
  });

  it("keeps each buyer's conversation, offer and reservation separate", async () => {
    const postId = await newPost(3);
    const a = await ask(ana, postId, reserve(1));
    const b = await ask(ben, postId, reserve(2));
    expect(a.conversationId).not.toBe(b.conversationId);
    await acceptOffer({ ownerId: seller, offerId: a.offerId });

    expect(await dealOf(a.offerId)).toMatchObject({ responderId: ana, quantity: 1, status: "agreed" });
    expect(await dealOf(b.offerId)).toBeUndefined();
    expect(await offerStatus(b.offerId)).toBe("pending");
    // Ben's thread shows his own offer and no reservation; Ana's shows hers.
    const benView = await getConversation(ben, b.conversationId);
    const anaView = await getConversation(ana, a.conversationId);
    expect(benView?.messages.map((m) => m.offer?.deal)).toEqual([null]);
    expect(anaView?.messages.map((m) => m.offer?.deal?.status)).toEqual(["agreed"]);
    // Neither can open the other's thread.
    expect(await getConversation(ana, b.conversationId)).toBeNull();
    expect(await getConversation(ben, a.conversationId)).toBeNull();
    // Cancelling Ana's reservation does not touch Ben's offer.
    await cancelDeal({ actorId: ana, dealId: (await dealOf(a.offerId)).id });
    expect(await offerStatus(b.offerId)).toBe("pending");
  });

  it("lets one buyer reserve several units in one reservation, and only one reservation each", async () => {
    const postId = await newPost(10);
    const a = await ask(ana, postId, reserve(4));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await dealOf(a.offerId)).toMatchObject({ quantity: 4, amount: 100 });
    expect(await unitsTaken(db, postId)).toBe(4);
    // Ana already has a reservation here.
    expect(await makeOffer({ responderId: ana, postId, input: reserve(1) })).toEqual({ ok: false, error: HAS_RESERVATION });
    expect((await getPostDetail(ana, postId))?.hasReservation).toBe(true);
    expect((await getPostDetail(ben, postId))?.hasReservation).toBe(false);
  });

  it("stores the price per unit and the units on the offer and the deal", async () => {
    const postId = await newPost(10);
    const a = await ask(ana, postId, bid(80, 3));
    expect(await db.select({ amount: offer.amount, quantity: offer.quantity }).from(offer).where(eq(offer.id, a.offerId))).toEqual([{ amount: 80, quantity: 3 }]);
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await dealOf(a.offerId)).toMatchObject({ amount: 80, quantity: 3 });
  });

  it("refuses an offer for more than is left, saying how many are", async () => {
    const postId = await newPost(3);
    expect(await makeOffer({ responderId: ana, postId, input: reserve(4) })).toEqual({ ok: false, error: "Only 3 left.", field: "quantity" });
    const a = await ask(ben, postId, reserve(2));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await makeOffer({ responderId: cy, postId, input: reserve(2) })).toEqual({ ok: false, error: "Only 1 is left.", field: "quantity" });
    expect((await makeOffer({ responderId: cy, postId, input: reserve(1) })).ok).toBe(true);
  });

  it("never uses more units than the post has when two accepts arrive at the same moment", async () => {
    const postId = await newPost(3);
    const a = await ask(ana, postId, reserve(2));
    const b = await ask(ben, postId, reserve(2));
    const c = await ask(cy, postId, reserve(1));
    const results = await Promise.all([a, b, c].map((o) => acceptOffer({ ownerId: seller, offerId: o.offerId })));
    expect(await unitsTaken(db, postId)).toBeLessThanOrEqual(3);
    // Ana+Cy (3) or Ben+Cy (3), or one of the pairs of 2 alone then Cy: whichever order, at most 3 and no overlap of Ana and Ben.
    const accepted = results.filter((r) => r.ok).length;
    expect(accepted).toBeGreaterThanOrEqual(1);
    expect(accepted).toBeLessThanOrEqual(2);
    const deals = await db.select().from(deal).where(eq(deal.postId, postId));
    expect(deals.reduce((sum, d) => sum + d.quantity, 0)).toBeLessThanOrEqual(3);
  });
});

describe("a buyer who already has an offer waiting", () => {
  it("is not offered Reserve or Make offer again, on the post, until that offer is settled", async () => {
    const postId = await newPost(5);
    const a = await ask(ana, postId, reserve(1));
    // The post page data says so, and a second try is refused with the reason.
    expect((await getPostDetail(ana, postId))?.myTransaction).toEqual({ conversationId: a.conversationId, offerId: a.offerId, isReserve: true, state: "pending", dealId: null });
    expect((await getPostDetail(ben, postId))?.myTransaction).toBeNull();
    expect((await getPostDetail(seller, postId))?.myTransaction).toBeNull();
    expect(await makeOffer({ responderId: ana, postId, input: reserve(1) })).toEqual({ ok: false, error: PENDING_OFFER });
    expect(await makeOffer({ responderId: ana, postId, input: bid(50) })).toEqual({ ok: false, error: PENDING_OFFER });
    // The thread shows where it stands, to each side.
    expect((await getConversation(ana, a.conversationId))?.listings).toMatchObject([{ state: "Reservation waiting", viewerIsOwner: false }]);
    expect((await getConversation(seller, a.conversationId))?.listings).toMatchObject([{ state: "Reservation waiting", viewerIsOwner: true }]);
    // Another buyer is unaffected.
    expect((await makeOffer({ responderId: ben, postId, input: reserve(1) })).ok).toBe(true);

    // Once the offer is withdrawn the buttons come back.
    await withdrawOffer({ responderId: ana, offerId: a.offerId });
    expect((await getPostDetail(ana, postId))?.myTransaction).toBeNull();
    expect((await getConversation(ana, a.conversationId))?.listings[0].state).toBe("Offer withdrawn");
    expect((await makeOffer({ responderId: ana, postId, input: reserve(1) })).ok).toBe(true);
  });

  it("gets the buttons back when the offer has run out of time, even before the job sweeps it", async () => {
    const postId = await newPost(5);
    const a = await ask(ana, postId, reserve(1));
    await db.update(offer).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(offer.id, a.offerId));
    expect((await getPostDetail(ana, postId))?.myTransaction).toBeNull();
    expect((await getConversation(ana, a.conversationId))?.listings[0].state).toBe("Offer expired");
    expect((await getConversation(ana, a.conversationId))?.messages[0].offer?.status).toBe("expired");
  });
});

describe("a buyer's offer or reservation on the post page", () => {
  it("is waiting, then accepted with its reservation, then gone once cancelled", async () => {
    const postId = await newPost(3);
    const a = await ask(ana, postId, reserve(1));
    expect((await getPostDetail(ana, postId))?.myTransaction).toMatchObject({ state: "pending", isReserve: true });
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    const dealId = (await dealOf(a.offerId)).id;
    expect((await getPostDetail(ana, postId))?.myTransaction).toEqual({ conversationId: a.conversationId, offerId: a.offerId, isReserve: true, state: "accepted", dealId });
    await cancelDeal({ actorId: ana, dealId });
    expect((await getPostDetail(ana, postId))?.myTransaction).toBeNull();

    const b = await ask(ben, postId, bid(90));
    expect((await getPostDetail(ben, postId))?.myTransaction).toMatchObject({ state: "pending", isReserve: false, offerId: b.offerId });
  });
});

describe("ongoing listings", () => {
  it("never run out: reservations keep being accepted and the post stays Active", async () => {
    const postId = await newPost(null);
    const buyers = [ana, ben, cy, dee];
    for (const [index, who] of buyers.entries()) {
      const o = await ask(who, postId, reserve(index + 1));
      expect((await acceptOffer({ ownerId: seller, offerId: o.offerId })).ok).toBe(true);
    }
    expect(await statusOf(postId)).toBe("open");
    expect(await unitsTaken(db, postId)).toBe(1 + 2 + 3 + 4);
    expect(quantityLine("showcase", null, 10)).toBe("10 reserved");
    expect((await getPostDetail(seller, postId))?.quantity).toBeNull();
    expect((await listOwnPosts(seller)).find((p) => p.id === postId)).toMatchObject({ quantity: null, unitsTaken: 10 });
  });
});

describe("cancelling a reservation", () => {
  it("turns a Fully reserved post back to Active, with at least a week left, and tells the other person", async () => {
    const postId = await newPost(2);
    await db.update(post).set({ expiresAt: sql`now() + interval '2 days'`, listedAt: sql`now() - interval '28 days'` }).where(eq(post.id, postId));
    const a = await ask(ana, postId, reserve(2));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await statusOf(postId)).toBe("reserved");
    const alerts: string[] = [];
    await db.delete(notification).where(inArray(notification.recipientId, people));

    const dealId = (await dealOf(a.offerId)).id;
    expect(await cancelDeal({ actorId: seller, dealId, alert: (id) => void alerts.push(id) })).toEqual({ ok: true, conversationId: a.conversationId });

    const row = await postRow(postId);
    expect(row.status).toBe("open");
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThanOrEqual(7 * DAY - 60_000);
    expect((await dealOf(a.offerId)).status).toBe("cancelled");
    expect(await unitsTaken(db, postId)).toBe(0);
    expect(await noticesFor(ana)).toEqual([{ type: "deal_cancelled" }]);
    expect(await noticesFor(seller)).toEqual([]);
    expect(alerts).toHaveLength(1);
    // The post takes offers again, and the same buyer may reserve again.
    expect((await makeOffer({ responderId: ana, postId, input: reserve(1) })).ok).toBe(true);
    expect((await getPostDetail(ben, postId))?.status).toBe("open");
  });

  it("either person can cancel; a stranger cannot; a cancelled reservation cannot be cancelled again", async () => {
    const postId = await newPost(3);
    const a = await ask(ana, postId, reserve(1));
    const b = await ask(ben, postId, reserve(1));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    await acceptOffer({ ownerId: seller, offerId: b.offerId });
    const dealA = (await dealOf(a.offerId)).id;
    const dealB = (await dealOf(b.offerId)).id;

    expect(await cancelDeal({ actorId: cy, dealId: dealA })).toEqual({ ok: false, error: DEAL_NOT_FOUND });
    expect(await cancelDeal({ actorId: ben, dealId: dealA })).toEqual({ ok: false, error: DEAL_NOT_FOUND }); // Ben is in another reservation
    expect(await cancelDeal({ actorId: randomUUID(), dealId: randomUUID() })).toEqual({ ok: false, error: DEAL_NOT_FOUND });
    expect((await cancelDeal({ actorId: ana, dealId: dealA })).ok).toBe(true); // the buyer
    expect(await cancelDeal({ actorId: ana, dealId: dealA })).toEqual({ ok: false, error: DEAL_CLOSED });
    expect((await cancelDeal({ actorId: seller, dealId: dealB })).ok).toBe(true); // the seller
    expect(await unitsTaken(db, postId)).toBe(0);
  });

  it("leaves a partly reserved post Active and frees only that reservation's units", async () => {
    const postId = await newPost(4);
    const a = await ask(ana, postId, reserve(1));
    const b = await ask(ben, postId, reserve(2));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    await acceptOffer({ ownerId: seller, offerId: b.offerId });
    expect(await unitsTaken(db, postId)).toBe(3);
    await cancelDeal({ actorId: ben, dealId: (await dealOf(b.offerId)).id });
    expect(await unitsTaken(db, postId)).toBe(1);
    expect(await statusOf(postId)).toBe("open");
  });
});

describe("a post with reservations", () => {
  it("is not expired when its time runs out; it stays reserved until they are done", async () => {
    const withDeal = await newPost(3);
    const without = await newPost(3);
    const a = await ask(ana, withDeal, reserve(1));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    for (const id of [withDeal, without]) {
      await db.update(post).set({ expiresAt: sql`now() - interval '1 minute'`, listedAt: sql`now() - interval '31 days'` }).where(eq(post.id, id));
    }
    await expirePosts();
    expect(await statusOf(withDeal)).toBe("reserved");
    expect(await statusOf(without)).toBe("expired");
    // When the reservation is cancelled it comes back with a week left.
    await cancelDeal({ actorId: ana, dealId: (await dealOf(a.offerId)).id });
    const row = await postRow(withDeal);
    expect(row.status).toBe("open");
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThanOrEqual(7 * DAY - 60_000);
  });

  it("cannot be withdrawn until the reservations are cancelled", async () => {
    const postId = await newPost(3);
    const a = await ask(ana, postId, reserve(1));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await withdrawPost(seller, postId)).toBe("has_reservations");
    expect(await statusOf(postId)).toBe("open");
    await cancelDeal({ actorId: seller, dealId: (await dealOf(a.offerId)).id });
    expect(await withdrawPost(seller, postId)).toBe("ok");
  });

  it("cannot be edited while an offer is waiting or a reservation is in progress, and can be once they are settled", async () => {
    const postId = await newPost(2);
    const editable = await getEditablePost(seller, postId);
    expect(editable?.lockedReason).toBeNull();
    const fields = (title: string, quantity = "2") => ({
      title,
      description: editable!.post.description,
      categoryId: editable!.post.categoryId,
      condition: null,
      priceKind: "amount" as const,
      priceAmount: "100",
      quantity,
      unlimited: false,
      exchangeMeetup: true,
      exchangeDelivery: false,
      meetupLocation: "Gate",
      deliveryArea: "",
      availability: [{ kind: "weekly" as const, weekday: 1, startTime: "09:00", endTime: "10:00" }],
      photos: editable!.photos.map((p) => ({ id: p.id, caption: "" })),
    });
    const edit = (title: string, quantity?: string) => updatePost({ ownerId: seller, postId, store: noStore, input: fields(title, quantity) });

    // An offer is waiting.
    const a = await ask(ana, postId, reserve(1));
    expect((await getEditablePost(seller, postId))?.lockedReason).toEqual(expect.stringContaining("offers or reservations"));
    expect(await edit("Changed while an offer waits")).toEqual({ ok: false, errors: { form: expect.stringContaining("offers or reservations") } });
    expect((await listOwnPosts(seller)).find((p) => p.id === postId)?.editLocked).toBe(true);
    expect((await getPostDetail(seller, postId))?.editLocked).toBe(true);
    expect((await getPostDetail(ana, postId))?.editLocked).toBe(false);

    // Accepted: a reservation is in progress, still locked.
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await edit("Changed during a reservation")).toMatchObject({ ok: false });
    expect((await postRow(postId)).title).not.toContain("Changed");

    // Cancelled: nothing is open, so it can be edited, even to more units.
    await cancelDeal({ actorId: seller, dealId: (await dealOf(a.offerId)).id });
    expect((await getEditablePost(seller, postId))?.lockedReason).toBeNull();
    expect((await edit("Edited after cancelling", "4")).ok).toBe(true);
    expect((await postRow(postId)).quantity).toBe(4);
    expect((await listOwnPosts(seller)).find((p) => p.id === postId)?.editLocked).toBe(false);
  });

  it("is unlocked when the offer is declined, withdrawn or runs out of time", async () => {
    const postId = await newPost(2);
    const a = await ask(ana, postId, reserve(1));
    expect((await getEditablePost(seller, postId))?.lockedReason).not.toBeNull();
    await declineOffer({ ownerId: seller, offerId: a.offerId });
    expect((await getEditablePost(seller, postId))?.lockedReason).toBeNull();
    const b = await ask(ben, postId, reserve(1));
    await withdrawOffer({ responderId: ben, offerId: b.offerId });
    expect((await getEditablePost(seller, postId))?.lockedReason).toBeNull();
    const c = await ask(cy, postId, reserve(1));
    await db.update(offer).set({ expiresAt: sql`now() - interval '1 minute'` }).where(eq(offer.id, c.offerId));
    expect((await getEditablePost(seller, postId))?.lockedReason).toBeNull();
  });
});

describe("wishlists", () => {
  it("let several students supply the same request, up to how many are needed", async () => {
    const postId = await newPost(2, "wishlist");
    const a = await ask(ana, postId, { kind: "reserve", quantity: "1", note: "" });
    const b = await ask(ben, postId, { kind: "reserve", quantity: "1", note: "" });
    const c = await ask(cy, postId, { kind: "reserve", quantity: "1", note: "" });
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    expect(await statusOf(postId)).toBe("open");
    await acceptOffer({ ownerId: seller, offerId: b.offerId });
    expect(await statusOf(postId)).toBe("reserved");
    expect(await offerStatus(c.offerId)).toBe("declined");
    expect((await getPostDetail(seller, postId))).toMatchObject({ quantity: 2, unitsTaken: 2, kind: "wishlist" });
    expect(quantityLine("wishlist", 2, 2)).toBe("2 of 2 supplied");
  });
});

describe("rules the database keeps", () => {
  it("allows one active deal per buyer on a post, even when there are units to spare", async () => {
    const postId = await newPost(5);
    const a = await ask(ana, postId, reserve(1));
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    // A second offer row for Ana (written directly, as the app would refuse it) cannot become a second active deal.
    const [second] = await db
      .insert(offer)
      .values({ conversationId: a.conversationId, postId, responderId: ana, amount: 100, quantity: 1, status: "declined", decidedAt: new Date(), expiresAt: new Date(Date.now() + DAY) })
      .returning({ id: offer.id });
    await expect(
      db.insert(deal).values({ postId, offerId: second.id, ownerId: seller, responderId: ana, amount: 100 }),
    ).rejects.toMatchObject({ cause: { code: "23505", constraint: "deal_one_active_idx" } });
    // Another buyer is fine.
    const b = await ask(ben, postId, reserve(1));
    expect((await acceptOffer({ ownerId: seller, offerId: b.offerId })).ok).toBe(true);
  });

  it("refuses a quantity outside 1 to 1,000 on a post, an offer or a deal, and units over the post's total", async () => {
    const postId = await newPost(2);
    await expect(db.update(post).set({ quantity: 0 }).where(eq(post.id, postId))).rejects.toMatchObject({ cause: { code: "23514" } });
    await expect(db.update(post).set({ quantity: 1001 }).where(eq(post.id, postId))).rejects.toMatchObject({ cause: { code: "23514" } });

    const a = await ask(ana, postId, reserve(1));
    await expect(db.update(offer).set({ quantity: 0 }).where(eq(offer.id, a.offerId))).rejects.toMatchObject({ cause: { code: "23514" } });
    // A deal for more units than the post has is refused even when written directly.
    await expect(
      db.insert(deal).values({ postId, offerId: a.offerId, ownerId: seller, responderId: ana, amount: 1, quantity: 3 }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
    // A post cannot be set below what is reserved.
    await acceptOffer({ ownerId: seller, offerId: a.offerId });
    await expect(db.update(post).set({ quantity: 0 }).where(eq(post.id, postId))).rejects.toMatchObject({ cause: { code: "23514" } });
    // Exactly what is reserved is fine.
    await db.update(post).set({ quantity: 1 }).where(eq(post.id, postId));
    expect((await postRow(postId)).quantity).toBe(1);
  });
});
