import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent, review, student } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { confirmHandover } from "@/lib/deals/confirm";
import { makeOffer } from "@/lib/deals/offers";
import { answerCash, giveCash, receiveCash, requestCash } from "@/lib/deals/payment";
import { ALREADY_REVIEWED, NOT_COMPLETED, OTHER_CLOSED, submitReview } from "@/lib/deals/review";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getReputation, listReviews } from "@/lib/deals/stats";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `rv-s-${run}`;
const ana = `rv-a-${run}`;
const ben = `rv-b-${run}`;
const people = [seller, ana, ben];
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

/** The seller owns every post. On a Wishlist the seller is the one who posted it (pays and receives), Ana supplies it. */
async function newPost(opts: { wishlist?: boolean; free?: boolean; quantity?: string } = {}): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: opts.wishlist ? "wishlist" : "showcase",
    title: `Review post ${run} #${counter}`,
    description: "A post to hand over.",
    categoryId: "other",
    condition: null,
    priceKind: opts.free ? "free" : "amount",
    priceAmount: opts.free ? "" : "500",
    paymentCash: true,
    paymentOnline: false,
    paymentOther: false,
    paymentNote: "",
    quantity: opts.quantity ?? "1",
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
async function reserved(responder: string, postId: string, quantity = "1"): Promise<{ dealId: string; conversationId: string }> {
  const offer = await makeOffer({ responderId: responder, postId, input: { kind: "reserve", quantity, note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  return { dealId: row.id, conversationId: offer.conversationId };
}

/** The coming Monday at 09:30 in the Philippines: inside the posts' availability. */
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
const after = new Date(slot.at.getTime() + HOUR);
const proposal = { method: "meetup", date: slot.date, time: slot.time, place: "Library steps" };

/** A scheduled handover at the slot: the responder proposes, the seller agrees. */
async function scheduled(postId: string, responder = ana, quantity = "1"): Promise<{ dealId: string }> {
  const r = await reserved(responder, postId, quantity);
  expect(await proposeHandover({ actorId: responder, dealId: r.dealId, input: proposal })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: seller, dealId: r.dealId, agree: true })).toMatchObject({ ok: true });
  return { dealId: r.dealId };
}

/** Both people say the handover happened. */
async function bothConfirm(dealId: string) {
  await confirmHandover({ actorId: ana, dealId, now: after });
  await confirmHandover({ actorId: seller, dealId, now: after });
}

/** A completed deal of a free post. */
async function completedFree(opts: { wishlist?: boolean } = {}): Promise<string> {
  const { dealId } = await scheduled(await newPost({ free: true, wishlist: opts.wishlist }));
  await bothConfirm(dealId);
  expect((await db.select({ s: deal.status }).from(deal).where(eq(deal.id, dealId)))[0].s).toBe("completed");
  return dealId;
}

/** A completed deal of a priced post, paid in cash in person. */
async function completedPriced(opts: { wishlist?: boolean; quantity: string }): Promise<string> {
  const payer = opts.wishlist ? seller : ana;
  const payee = opts.wishlist ? ana : seller;
  const { dealId } = await scheduled(await newPost({ wishlist: opts.wishlist, quantity: "3" }), ana, opts.quantity);
  await requestCash({ actorId: payer, dealId });
  await answerCash({ actorId: payee, dealId, agree: true });
  await giveCash({ actorId: payer, dealId });
  await receiveCash({ actorId: payee, dealId });
  await bothConfirm(dealId);
  expect((await db.select({ s: deal.status }).from(deal).where(eq(deal.id, dealId)))[0].s).toBe("completed");
  return dealId;
}

/** The Postgres error code behind a failed query. */
async function codeOf(attempt: () => Promise<unknown>): Promise<unknown> {
  try {
    await attempt();
  } catch (error) {
    return error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? error.cause.code : "no code";
  }
  return "no error";
}

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Outsider" });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.update(student).set({ accountStatus: "active" }).where(inArray(student.id, people));
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

describe("writing a review", () => {
  it("is refused before the handover is complete", async () => {
    const { dealId } = await scheduled(await newPost({ free: true }));
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 5 } })).toEqual({ ok: false, error: NOT_COMPLETED });
    expect(await db.select().from(review).where(eq(review.dealId, dealId))).toEqual([]);
  });

  it("is allowed once to each person, and never by someone outside the deal", async () => {
    const dealId = await completedFree();
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 5, text: "  Quick and friendly  " } })).toMatchObject({ ok: true });
    expect(await submitReview({ actorId: seller, dealId, input: { rating: 4 } })).toMatchObject({ ok: true });
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 1 } })).toEqual({ ok: false, error: ALREADY_REVIEWED });
    expect(await submitReview({ actorId: ben, dealId, input: { rating: 5 } })).toEqual({ ok: false, error: DEAL_NOT_FOUND });

    const rows = await db.select().from(review).where(eq(review.dealId, dealId));
    expect(rows.map((r) => ({ by: r.reviewerId, of: r.revieweeId, rating: r.rating, text: r.text })).sort((a, b) => a.by.localeCompare(b.by))).toEqual(
      [
        { by: ana, of: seller, rating: 5, text: "Quick and friendly" },
        { by: seller, of: ana, rating: 4, text: null },
      ].sort((a, b) => a.by.localeCompare(b.by)),
    );
  });

  it("takes 1 to 5 stars and a note of at most 500 characters", async () => {
    const dealId = await completedFree();
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 0 } })).toEqual({ ok: false, error: "Choose 1 to 5 stars." });
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 6 } })).toEqual({ ok: false, error: "Choose 1 to 5 stars." });
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 3.5 } })).toEqual({ ok: false, error: "Choose 1 to 5 stars." });
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 3, text: "a".repeat(501) } })).toEqual({ ok: false, error: "Choose 1 to 5 stars." });
    expect(await db.select().from(review).where(eq(review.dealId, dealId))).toEqual([]);
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 3, text: "a".repeat(500) } })).toMatchObject({ ok: true });
  });

  it("is refused when the other student's account is closed", async () => {
    const dealId = await completedFree();
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, seller));
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 5 } })).toEqual({ ok: false, error: OTHER_CLOSED });
  });

  it("is backed by the database: a review of an unfinished deal and any change to a review are refused", async () => {
    const { dealId } = await scheduled(await newPost({ free: true }));
    expect(await codeOf(() => db.insert(review).values({ dealId, reviewerId: ana, revieweeId: seller, rating: 5 }))).toBe("23514");

    const done = await completedFree();
    expect(await submitReview({ actorId: ana, dealId: done, input: { rating: 5 } })).toMatchObject({ ok: true });
    expect(await codeOf(() => db.update(review).set({ rating: 1 }).where(eq(review.dealId, done)))).toBe("23514");
  });
});

describe("what a student has earned", () => {
  it("is nothing before any deal or review", async () => {
    expect(await getReputation(seller)).toEqual({ rating: null, sold: 0, granted: 0, bought: 0 });
  });

  it("counts units sold and bought on a Showcase, and a free one only as granted", async () => {
    await completedPriced({ quantity: "2" });
    expect(await getReputation(seller)).toMatchObject({ sold: 2, granted: 0, bought: 0 });
    expect(await getReputation(ana)).toMatchObject({ sold: 0, granted: 0, bought: 2 });

    await completedFree();
    expect(await getReputation(seller)).toMatchObject({ sold: 2, granted: 1, bought: 0 });
    expect(await getReputation(ana)).toMatchObject({ sold: 0, granted: 0, bought: 2 });
    expect(await getReputation(ben)).toEqual({ rating: null, sold: 0, granted: 0, bought: 0 });
  });

  it("gives the one who supplies a Wishlist the sale or gift, and the one who posted it the purchase", async () => {
    await completedPriced({ wishlist: true, quantity: "2" });
    expect(await getReputation(ana)).toMatchObject({ sold: 2, granted: 0, bought: 0 });
    expect(await getReputation(seller)).toMatchObject({ sold: 0, granted: 0, bought: 2 });

    await completedFree({ wishlist: true });
    expect(await getReputation(ana)).toMatchObject({ sold: 2, granted: 1, bought: 0 });
    expect(await getReputation(seller)).toMatchObject({ sold: 0, granted: 0, bought: 2 });
  });

  it("does not count a deal that is not completed", async () => {
    await scheduled(await newPost({ free: true }));
    expect(await getReputation(seller)).toMatchObject({ sold: 0, granted: 0, bought: 0 });
  });

  it("averages the stars received, and is null without any", async () => {
    const first = await completedFree();
    const second = await completedFree();
    expect((await getReputation(seller)).rating).toBeNull();
    expect(await submitReview({ actorId: ana, dealId: first, input: { rating: 5 } })).toMatchObject({ ok: true });
    expect(await submitReview({ actorId: ana, dealId: second, input: { rating: 2 } })).toMatchObject({ ok: true });
    expect((await getReputation(seller)).rating).toEqual({ average: 3.5, count: 2 });
    // Reviews given do not count for the one who wrote them.
    expect((await getReputation(ana)).rating).toBeNull();
  });
});

describe("the reviews listed on a profile", () => {
  it("show the post, the note and the reviewer's name, newest first", async () => {
    const first = await completedFree();
    const second = await completedFree();
    await submitReview({ actorId: ana, dealId: first, input: { rating: 4, text: "Good" } });
    await submitReview({ actorId: ana, dealId: second, input: { rating: 5 } });
    const items = await listReviews(seller);
    expect(items.map((i) => ({ rating: i.rating, text: i.text, reviewerName: i.reviewerName }))).toEqual([
      { rating: 5, text: null, reviewerName: "Ana Buyer" },
      { rating: 4, text: "Good", reviewerName: "Ana Buyer" },
    ]);
    expect(items[0].postTitle).toContain(run);
    expect(await listReviews(seller, 1)).toHaveLength(1);
  });

  it("show a deleted reviewer as 'Deleted student', a suspended one as 'Student', and never an email", async () => {
    const first = await completedFree();
    await submitReview({ actorId: ana, dealId: first, input: { rating: 4 } });
    await db.update(student).set({ accountStatus: "deleted" }).where(eq(student.id, ana));
    const deleted = await listReviews(seller);
    expect(deleted.map((i) => i.reviewerName)).toEqual(["Deleted student"]);
    expect(JSON.stringify(deleted)).not.toContain("testschool");

    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ana));
    expect((await listReviews(seller)).map((i) => i.reviewerName)).toEqual(["Student"]);
  });
});
