import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { block, conversation, deal, image, notification, post, rateLimitEvent, review, student } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { getReputation, listHandovers, listReviews, parsePage, PROFILE_LIST_PAGE_SIZE } from "@/lib/deals/stats";
import { getDb, getPool } from "@/lib/db";
import { getPublicProfile } from "@/lib/identity/profile";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 240_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `hs-s-${run}`;
const ana = `hs-a-${run}`;
const ben = `hs-b-${run}`;
const people = [seller, ana, ben];
const DAY = 86_400_000;
const now = Date.now();

type Kind = "showcase" | "wishlist";

/** The seller owns every post; on a Wishlist that makes them the poster and Ana the one who supplies it. */
async function newPost(title: string, opts: { kind?: Kind; free?: boolean } = {}): Promise<string> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: opts.kind ?? "showcase",
    title,
    description: "A post to hand over.",
    categoryId: "other",
    condition: null,
    priceKind: opts.free ? "free" : "amount",
    priceAmount: opts.free ? "" : "500",
    paymentCash: true,
    paymentOnline: false,
    paymentOther: false,
    paymentNote: "",
    quantity: "5",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Main gate",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** A reservation by `responder` on the post, accepted, then taken straight to completed at `completedAt`. */
async function completed(postId: string, responder: string, quantity: number, completedAt: Date): Promise<string> {
  const offer = await makeOffer({ responderId: responder, postId, input: { kind: "reserve", quantity: String(quantity), note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id, amount: deal.amount }).from(deal).where(eq(deal.offerId, offer.offerId));
  await db.update(deal).set({ status: "scheduled", handoverMethod: "meetup", scheduledAt: completedAt, place: "Somewhere private" }).where(eq(deal.id, row.id));
  const paid = row.amount > 0 ? { paidAt: completedAt, paymentMethod: "cash", paymentConfirmedAt: completedAt } : {};
  await db
    .update(deal)
    .set({ status: "completed", ownerConfirmedAt: completedAt, responderConfirmedAt: new Date(completedAt.getTime() - 60_000), ...paid })
    .where(eq(deal.id, row.id));
  return row.id;
}

async function addReview(dealId: string, reviewerId: string, revieweeId: string, rating: number, createdAt: Date, text?: string) {
  await db.insert(review).values({ dealId, reviewerId, revieweeId, rating, text: text ?? null, createdAt });
}

/** Runs `body` with the post changed, then puts it back. */
async function withPost(postId: string, patch: Partial<typeof post.$inferInsert>, body: () => Promise<void>) {
  const [before] = await db.select().from(post).where(eq(post.id, postId));
  const restore = Object.fromEntries(Object.keys(patch).map((key) => [key, before[key as keyof typeof before]]));
  await db.update(post).set(patch).where(eq(post.id, postId));
  try {
    await body();
  } finally {
    await db.update(post).set(restore).where(eq(post.id, postId));
  }
}

const ids: Record<string, string> = {};
const titles = {
  paid: `Paid showcase ${run}`,
  free: `Free showcase ${run}`,
  wish: `Wishlist ${run}`,
  late: `Late showcase ${run}`,
};

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Outsider" });
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));

  ids.paid = await newPost(titles.paid);
  ids.free = await newPost(titles.free, { free: true });
  ids.wish = await newPost(titles.wish, { kind: "wishlist" });
  ids.late = await newPost(titles.late);

  // Completed 4, 3, 2 and 1 days ago. The seller sold 2 + 1 units, gave 1 away, and bought 1 on their own Wishlist.
  const paid = await completed(ids.paid, ana, 2, new Date(now - 4 * DAY));
  const free = await completed(ids.free, ana, 1, new Date(now - 3 * DAY));
  const wish = await completed(ids.wish, ana, 1, new Date(now - 2 * DAY));
  const late = await completed(ids.late, ben, 1, new Date(now - 1 * DAY));
  Object.assign(ids, { dealPaid: paid, dealFree: free, dealWish: wish, dealLate: late });

  await addReview(paid, ana, seller, 5, new Date(now - 4 * DAY + 1000), "Great");
  await addReview(free, ana, seller, 4, new Date(now - 3 * DAY + 1000));
  await addReview(late, ben, seller, 3, new Date(now - 1 * DAY + 1000), "Fine");
  await addReview(paid, seller, ana, 5, new Date(now - 4 * DAY + 2000), "Lovely");
}, 240_000);

afterAll(async () => {
  await db.delete(block).where(inArray(block.blockerId, people));
  await db.update(student).set({ accountStatus: "active" }).where(inArray(student.id, people));
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(conversation).where(inArray(conversation.participantA, people));
  await db.delete(conversation).where(inArray(conversation.participantB, people));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
}, 120_000);

describe("parsePage", () => {
  it("reads a whole number from 1 up and sends anything else to the first page", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(undefined)).toBe(1);
    expect([parsePage("0"), parsePage("-2"), parsePage("x"), parsePage("1.5"), parsePage("99999"), parsePage(["2"])]).toEqual([1, 1, 1, 1, 1, 1]);
  });
});

describe("the reviews page query", () => {
  it("lists newest first with only the post kind, title, reviewer, stars, note and date", async () => {
    const { items, hasMore } = await listReviews(ben, seller);
    expect(hasMore).toBe(false);
    expect(items.map((i) => [i.rating, i.text, i.postKind, i.postTitle, i.reviewerLabel, i.reviewerHandle])).toEqual([
      [3, "Fine", "showcase", titles.late, `@ben_${run}`, `ben_${run}`],
      [4, null, "showcase", titles.free, `@ana_${run}`, `ana_${run}`],
      [5, "Great", "showcase", titles.paid, `@ana_${run}`, `ana_${run}`],
    ]);
    expect(Object.keys(items[0]).sort()).toEqual(["createdAt", "id", "postKind", "postTitle", "rating", "reviewerHandle", "reviewerLabel", "text"]);
    const dump = JSON.stringify(items);
    expect(dump).not.toContain("Somewhere private");
    expect(dump).not.toContain("testschool");
  });

  it("is the same list for the reviewed person and for any other signed-in student", async () => {
    expect((await listReviews(ana, seller)).items.map((i) => i.id)).toEqual((await listReviews(ben, seller)).items.map((i) => i.id));
  });

  it("shows the post title of a finished listing, whatever its status, unless it was hidden or removed", async () => {
    // Ana is the reviewed person on the paid post's review from the seller; the seller owns the post; Ben is a stranger.
    const titleSeenBy = async (viewer: string, reviewee: string) => (await listReviews(viewer, reviewee)).items.map((i) => i.postTitle);
    expect(await titleSeenBy(ben, ana)).toEqual([titles.paid]);

    for (const status of ["withdrawn", "expired", "fulfilled"]) {
      await withPost(ids.paid, { status }, async () => {
        expect(await titleSeenBy(ben, ana)).toEqual([titles.paid]);
      });
    }

    for (const status of ["hidden", "removed"]) {
      await withPost(ids.paid, { status }, async () => {
        expect(await titleSeenBy(ben, ana)).toEqual([null]);
        expect(await titleSeenBy(ana, ana)).toEqual([titles.paid]); // the reviewed person
        expect(await titleSeenBy(seller, ana)).toEqual([titles.paid]); // the owner
        expect((await listReviews(ben, seller)).items.map((i) => i.postTitle)).toEqual([titles.late, titles.free, null]);
      });
    }
    expect(await titleSeenBy(ben, ana)).toEqual([titles.paid]);
  });

  it("hides the title of a post whose owner is not active, or who is blocked either way", async () => {
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, seller));
    try {
      expect((await listReviews(ben, ana)).items.map((i) => i.postTitle)).toEqual([null]);
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, seller));
    }

    await db.insert(block).values({ blockerId: ben, blockedId: seller });
    try {
      expect((await listReviews(ben, ana)).items.map((i) => i.postTitle)).toEqual([null]);
    } finally {
      await db.delete(block).where(eq(block.blockerId, ben));
    }
    await db.insert(block).values({ blockerId: seller, blockedId: ben });
    try {
      expect((await listReviews(ben, ana)).items.map((i) => i.postTitle)).toEqual([null]);
    } finally {
      await db.delete(block).where(eq(block.blockerId, seller));
    }
    expect((await listReviews(ben, ana)).items.map((i) => i.postTitle)).toEqual([titles.paid]);
  });

  it("labels a Wishlist as such", async () => {
    // The reviewed person's own Wishlist deal: Ana supplied it and Sam reviews her.
    await addReview(ids.dealWish, seller, ana, 2, new Date(now - 2 * DAY + 1000));
    const { items } = await listReviews(ben, ana);
    expect(items.map((i) => [i.postKind, i.postTitle])).toEqual([
      ["wishlist", titles.wish],
      ["showcase", titles.paid],
    ]);
  });

  it("shows a deleted reviewer as 'Deleted account' with no link, and a suspended one as 'Student' with no link", async () => {
    await db.update(student).set({ accountStatus: "deleted" }).where(eq(student.id, ben));
    try {
      const gone = (await listReviews(ana, seller)).items.find((i) => i.rating === 3);
      expect(gone).toMatchObject({ reviewerLabel: "Deleted account", reviewerHandle: null });
      expect(JSON.stringify(gone)).not.toContain("ben_");

      await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ben));
      expect((await listReviews(ana, seller)).items.find((i) => i.rating === 3)).toMatchObject({ reviewerLabel: "Student", reviewerHandle: null });
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, ben));
    }
  });

  it("pages with a flag for more, and an empty page past the end", async () => {
    const all = (await listReviews(ben, seller)).items.map((i) => i.id);
    expect(all).toHaveLength(3);
    const first = await listReviews(ben, seller, 1, 2);
    const second = await listReviews(ben, seller, 2, 2);
    expect([first.hasMore, second.hasMore]).toEqual([true, false]);
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual(all);
    expect(await listReviews(ben, seller, 3, 2)).toEqual({ items: [], hasMore: false });
    expect(PROFILE_LIST_PAGE_SIZE).toBe(20);
  });

  it("is not reachable through a profile of a student who blocked the viewer, or whom the viewer blocked", async () => {
    expect(await getPublicProfile(ben, `sell_${run}`)).toMatchObject({ id: seller });
    await db.insert(block).values({ blockerId: seller, blockedId: ben });
    try {
      expect(await getPublicProfile(ben, `sell_${run}`)).toBeNull();
    } finally {
      await db.delete(block).where(eq(block.blockerId, seller));
    }
    await db.insert(block).values({ blockerId: ben, blockedId: seller });
    try {
      expect(await getPublicProfile(ben, `sell_${run}`)).toBeNull();
    } finally {
      await db.delete(block).where(eq(block.blockerId, ben));
    }
  });
});

describe("the sold, granted and bought pages query", () => {
  const handovers = (viewerId: string, studentId: string, kind: "sold" | "granted" | "bought", page = 1, pageSize?: number) =>
    listHandovers({ viewerId, studentId, kind, page, pageSize });

  it("lists the deals behind the counts, newest first, with kind, title, quantity and completion month only", async () => {
    const sold = await handovers(ben, seller, "sold");
    expect(sold.items.map((i) => [i.postKind, i.postTitle, i.quantity])).toEqual([
      ["showcase", titles.late, 1],
      ["showcase", titles.paid, 2],
    ]);
    expect(sold.items[0].completedAt.getTime()).toBeCloseTo(now - DAY, -4);
    expect(Object.keys(sold.items[0]).sort()).toEqual(["completedAt", "dealId", "postKind", "postTitle", "quantity"]);

    const granted = await handovers(ben, seller, "granted");
    expect(granted.items.map((i) => [i.postTitle, i.quantity])).toEqual([[titles.free, 1]]);

    // The one who supplies a Wishlist sold it.
    expect((await handovers(ben, ana, "sold")).items.map((i) => [i.postKind, i.postTitle, i.quantity])).toEqual([["wishlist", titles.wish, 1]]);

    const rep = await getReputation(seller);
    expect(sold.items.reduce((n, i) => n + i.quantity, 0)).toBe(rep.sold);
    expect(granted.items.reduce((n, i) => n + i.quantity, 0)).toBe(rep.granted);
  });

  it("keeps Bought private: only the student sees it, anyone else gets an empty page", async () => {
    const own = await handovers(ana, ana, "bought");
    expect(own.items.map((i) => [i.postTitle, i.quantity])).toEqual([[titles.paid, 2]]);
    expect((await handovers(seller, seller, "bought")).items.map((i) => [i.postKind, i.postTitle, i.quantity])).toEqual([["wishlist", titles.wish, 1]]);
    for (const viewer of [ben, seller]) expect(await handovers(viewer, ana, "bought")).toEqual({ items: [], hasMore: false });
    expect(await handovers(ana, seller, "bought")).toEqual({ items: [], hasMore: false });
    expect((await getReputation(ana)).bought).toBe(2);
  });

  it("shows 'A listing' for posts an admin hid or removed, or that the viewer is blocked from, except to the owner and the student themselves", async () => {
    await withPost(ids.paid, { status: "removed" }, async () => {
      expect((await handovers(ben, seller, "sold")).items.map((i) => i.postTitle)).toEqual([titles.late, null]);
      expect((await handovers(seller, seller, "sold")).items.map((i) => i.postTitle)).toEqual([titles.late, titles.paid]);
      expect((await handovers(ana, ana, "bought")).items.map((i) => i.postTitle)).toEqual([titles.paid]);
    });
    await db.insert(block).values({ blockerId: ben, blockedId: seller });
    try {
      expect((await handovers(ben, seller, "sold")).items.map((i) => i.postTitle)).toEqual([null, null]);
    } finally {
      await db.delete(block).where(eq(block.blockerId, ben));
    }
  });

  it("pages with a flag for more", async () => {
    const first = await handovers(ben, seller, "sold", 1, 1);
    const second = await handovers(ben, seller, "sold", 2, 1);
    expect([first.items.length, first.hasMore, second.items.length, second.hasMore]).toEqual([1, true, 1, false]);
    expect(first.items[0].dealId).not.toBe(second.items[0].dealId);
    expect(await handovers(ben, seller, "sold", 3, 1)).toEqual({ items: [], hasMore: false });
  });
});
