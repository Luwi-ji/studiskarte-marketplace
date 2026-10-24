import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent, student } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { getDb, getPool } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";
import { createPost, type SaveResult } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { SHOWCASE_NEEDS_ID_AFTER_SALE, SHOWCASE_NEEDS_ID_CHECK, showcaseStanding, WISHLIST_NEEDS_ID_AFTER_SALE } from "@/lib/posts/showcase-limit";
import { updatePost } from "@/lib/posts/update";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `sl-s-${run}`;
const buyer = `sl-b-${run}`;
const people = [seller, buyer];
let counter = 0;

const store: ObjectStore = { put: async () => {}, delete: async () => {}, signedUrl: async (key) => key };

async function input(kind: "showcase" | "wishlist"): Promise<NewPostInput> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  return {
    kind,
    title: `Trial ${run} #${++counter}`,
    description: "A post.",
    categoryId: "other",
    condition: null,
    priceKind: "free",
    priceAmount: "",
    paymentCash: true,
    paymentOnline: false,
    paymentOther: false,
    paymentNote: "",
    quantity: "1",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Main gate",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
}

async function make(kind: "showcase" | "wishlist" = "showcase"): Promise<SaveResult> {
  return createPost({ ownerId: seller, input: await input(kind) });
}

async function must(kind: "showcase" | "wishlist" = "showcase"): Promise<string> {
  const result = await make(kind);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** The buyer reserves the post and the deal is taken straight to completed. */
async function sell(postId: string): Promise<void> {
  const offer = await makeOffer({ responderId: buyer, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  const at = new Date(Date.now() - 3_600_000);
  await db.update(deal).set({ status: "scheduled", handoverMethod: "meetup", scheduledAt: at, place: "Somewhere private" }).where(eq(deal.id, row.id));
  await db.update(deal).set({ status: "completed", ownerConfirmedAt: at, responderConfirmedAt: at }).where(eq(deal.id, row.id));
}

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sls_${run}`, name: "Sam Seller" });
  await createTestStudent(buyer, { handle: `slb_${run}`, name: "Bea Buyer" });
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("R2_ID_BUCKET", "id-bucket-test");
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(conversation).where(or(eq(conversation.participantA, seller), eq(conversation.participantB, seller)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  await db.update(student).set({ idCheckedAt: null, idCheckExpiresAt: null }).where(inArray(student.id, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("an unverified student's showcases", () => {
  it("can post another after the first was withdrawn or deleted without a sale", async () => {
    const first = await must();
    expect(await make()).toEqual({ ok: false, errors: { form: SHOWCASE_NEEDS_ID_CHECK } });
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, first));
    const second = await must();
    await db.update(post).set({ status: "withdrawn", ownerDeletedAt: new Date() }).where(eq(post.id, second));
    expect(await make()).toMatchObject({ ok: true });
  });

  it("cannot post another once a showcase sale is complete, even after that post is deleted", async () => {
    const first = await must();
    await sell(first);
    await db.update(post).set({ status: "fulfilled" }).where(eq(post.id, first));
    expect(await make()).toEqual({ ok: false, errors: { form: SHOWCASE_NEEDS_ID_AFTER_SALE } });
    expect(await showcaseStanding(db, seller)).toBe("sold");

    await db.update(post).set({ ownerDeletedAt: new Date() }).where(eq(post.id, first));
    expect(await make()).toEqual({ ok: false, errors: { form: SHOWCASE_NEEDS_ID_AFTER_SALE } });
  });

  it("can still post a Wishlist after a sale, and a current ID check lifts the showcase block", async () => {
    await sell(await must());
    expect(await make("wishlist")).toMatchObject({ ok: true });
    expect(await make()).toMatchObject({ ok: false });

    await db.update(student).set({ idCheckedAt: new Date(), idCheckExpiresAt: new Date(Date.now() + 86_400_000) }).where(eq(student.id, seller));
    expect(await make()).toMatchObject({ ok: true });
    expect(await showcaseStanding(db, seller)).toBe("checked");
  });

  it("cannot relist an expired showcase from the edit page after a sale", async () => {
    // A showcase that expired before any sale frees its slot, so a second showcase can be posted and sold.
    const expired = await must();
    await db.update(post).set({ status: "expired", expiresAt: new Date(Date.now() - 86_400_000) }).where(eq(post.id, expired));
    const sold = await must();
    await sell(sold);
    await db.update(post).set({ status: "fulfilled" }).where(eq(post.id, sold));
    const { kind: _kind, ...fields } = await input("showcase");
    void _kind;
    const result = await updatePost({ ownerId: seller, postId: expired, input: fields, store, relist: true });
    expect(result).toEqual({ ok: false, errors: { form: SHOWCASE_NEEDS_ID_AFTER_SALE } });
  });

  it("is not limited while ID checks are closed, because nobody could lift it", async () => {
    vi.stubEnv("R2_ID_BUCKET", "");
    await sell(await must());
    expect(await make()).toMatchObject({ ok: true });
    expect(await showcaseStanding(db, seller)).toBe("off");
  });
});

describe("selling through a Wishlist", () => {
  const db2 = db;

  it("counts as the first sale, and then needs an ID check like a new showcase does", async () => {
    // The seller posts two Wishlists; the buyer is the one who supplies them, so on a Wishlist the buyer is the seller.
    const first = await must("wishlist");
    const second = await must("wishlist");
    expect(await showcaseStanding(db2, buyer)).toBe("free");
    expect(await makeOffer({ responderId: buyer, postId: second, input: { kind: "reserve", quantity: "1", note: "" } })).toMatchObject({ ok: true });
    await db2.delete(deal).where(eq(deal.postId, second));

    await sell(first);
    expect(await showcaseStanding(db2, buyer)).toBe("sold");
    // The poster of a Wishlist has bought, not sold.
    expect(await showcaseStanding(db2, seller)).toBe("free");

    const third = await must("wishlist");
    expect(await makeOffer({ responderId: buyer, postId: third, input: { kind: "reserve", quantity: "1", note: "" } })).toEqual({ ok: false, error: WISHLIST_NEEDS_ID_AFTER_SALE });

    await db2.update(student).set({ idCheckedAt: new Date(), idCheckExpiresAt: new Date(Date.now() + 86_400_000) }).where(eq(student.id, buyer));
    expect(await makeOffer({ responderId: buyer, postId: third, input: { kind: "reserve", quantity: "1", note: "" } })).toMatchObject({ ok: true });
  });

  it("is not limited while ID checks are closed", async () => {
    vi.stubEnv("R2_ID_BUCKET", "");
    const first = await must("wishlist");
    await sell(first);
    const second = await must("wishlist");
    expect(await makeOffer({ responderId: buyer, postId: second, input: { kind: "reserve", quantity: "1", note: "" } })).toMatchObject({ ok: true });
  });
});
