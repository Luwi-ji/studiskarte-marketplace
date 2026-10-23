import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { conversation, image, notification, post, rateLimitEvent } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { getDb, getPool } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";
import { changePosts } from "@/lib/posts/bulk";
import { createPost } from "@/lib/posts/create";
import { listOwnPosts } from "@/lib/posts/mine";
import { countOwnPosts, inOwnView, parseOwnView, ownViewHref } from "@/lib/posts/own-view";
import { OPEN_POSTS_MAX, type NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// Many round trips to a hosted database.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `bulk-a-${run}`;
const other = `bulk-b-${run}`;
const buyer = `bulk-c-${run}`;
const people = [owner, other, buyer];
let counter = 0;

const store: ObjectStore = { put: async () => {}, delete: async () => {}, signedUrl: async () => "" };

async function newPost(by: string, kind: "showcase" | "wishlist" = "showcase"): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: by, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind,
    title: `Bulk post ${run} #${counter}`,
    description: "A post for the bulk tests.",
    categoryId: "other",
    condition: null,
    priceKind: "amount",
    priceAmount: "100",
    quantity: "3",
    unlimited: false,
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: by, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** A post in the given status: made open, then moved (a status change the app makes through its own jobs). */
async function postIn(status: string, by = owner): Promise<string> {
  const id = await newPost(by);
  if (status !== "open") await db.update(post).set({ status, expiresAt: new Date(Date.now() - 1000) }).where(eq(post.id, id));
  return id;
}

const statusOf = async (id: string) => (await db.select({ s: post.status }).from(post).where(eq(post.id, id)))[0]?.s;
const openCount = async () => (await listOwnPosts(owner)).filter((p) => p.status === "open").length;

beforeAll(async () => {
  await createTestStudent(owner, { handle: `ba_${run}`, name: "Bulk Owner" });
  await createTestStudent(other, { handle: `bb_${run}`, name: "Bulk Other" });
  await createTestStudent(buyer, { handle: `bc_${run}`, name: "Bulk Buyer" });
}, 60_000);

afterAll(async () => {
  await db.delete(post).where(inArray(post.ownerId, people));
  await db.delete(conversation).where(or(inArray(conversation.participantA, people), inArray(conversation.participantB, people)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("changePosts", () => {
  it("withdraws several open posts, frees their slots, and says which ones it could not", async () => {
    const [a, b, expired, theirs] = [await postIn("open"), await postIn("open"), await postIn("expired"), await postIn("open", other)];
    const before = await openCount();
    const results = await changePosts({ ownerId: owner, action: "withdraw", ids: [a, b, expired, theirs, a], store });

    // One result per post, in order, and a repeated id is handled once.
    expect(results.map((r) => r.id)).toEqual([a, b, expired, theirs]);
    expect(results.map((r) => r.ok)).toEqual([true, true, false, false]);
    expect(results[2]).toMatchObject({ ok: false, reason: expect.stringContaining("open or reserved") });
    expect(await statusOf(a)).toBe("withdrawn");
    expect(await statusOf(expired)).toBe("expired");
    expect(await statusOf(theirs)).toBe("open");
    expect(await openCount()).toBe(before - 2);
  });

  it("refuses to withdraw a post with a reservation in progress, as the single action does", async () => {
    const reserved = await postIn("open");
    const free = await postIn("open");
    const offer = await makeOffer({ responderId: buyer, postId: reserved, input: { kind: "reserve", quantity: "1", note: "" } });
    if (!offer.ok) throw new Error(offer.error);
    await acceptOffer({ ownerId: owner, offerId: offer.offerId });

    const results = await changePosts({ ownerId: owner, action: "withdraw", ids: [reserved, free], store });
    expect(results[0]).toMatchObject({ ok: false, reason: expect.stringContaining("reservation") });
    expect(results[1]).toMatchObject({ ok: true });
    expect(await statusOf(reserved)).toBe("open");
    expect(await statusOf(free)).toBe("withdrawn");
  });

  it("deletes only expired or withdrawn posts from the list", async () => {
    const [expired, withdrawn, open] = [await postIn("expired"), await postIn("withdrawn"), await postIn("open")];
    const results = await changePosts({ ownerId: owner, action: "delete", ids: [expired, withdrawn, open], store });
    expect(results.map((r) => r.ok)).toEqual([true, true, false]);
    expect(results[2]).toMatchObject({ reason: expect.stringContaining("expired or withdrawn") });
    const listed = (await listOwnPosts(owner)).map((p) => p.id);
    expect(listed).not.toContain(expired);
    expect(listed).not.toContain(withdrawn);
    expect(listed).toContain(open);
  });

  it("only relists expired posts", async () => {
    const withdrawn = await postIn("withdrawn");
    const [result] = await changePosts({ ownerId: owner, action: "relist", ids: [withdrawn], store });
    expect(result).toMatchObject({ ok: false, reason: expect.stringContaining("expired") });
    expect(await statusOf(withdrawn)).toBe("withdrawn");
  });
  it("relists expired posts for 30 days and stops at the open-post limit", async () => {
    const expired = [await postIn("expired"), await postIn("expired"), await postIn("expired")];
    const open = await openCount();
    // Fill all but one slot, so only the first relist fits.
    const fill = OPEN_POSTS_MAX - 1 - open;
    for (let i = 0; i < fill; i += 1) await postIn("open");
    expect(await openCount()).toBe(OPEN_POSTS_MAX - 1);

    const results = await changePosts({ ownerId: owner, action: "relist", ids: [...expired, expired[0]], store });
    expect(results.map((r) => r.ok)).toEqual([true, false, false]);
    expect(results[1]).toMatchObject({ reason: expect.stringContaining(`${OPEN_POSTS_MAX} open posts`) });
    expect(await statusOf(expired[0])).toBe("open");
    expect(await statusOf(expired[1])).toBe("expired");
    const [row] = await db.select({ expiresAt: post.expiresAt }).from(post).where(eq(post.id, expired[0]));
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect(await openCount()).toBe(OPEN_POSTS_MAX);
  });

});

describe("My posts view", () => {
  it("reads the address, with the older ?tab= name for the type", () => {
    expect(parseOwnView({})).toEqual({ type: "all", status: "all" });
    expect(parseOwnView({ tab: "wishlist" })).toEqual({ type: "wishlist", status: "all" });
    expect(parseOwnView({ type: "showcase", status: "expired" })).toEqual({ type: "showcase", status: "expired" });
    expect(parseOwnView({ type: "bogus", status: ["open", "x"] })).toEqual({ type: "all", status: "open" });
    expect(ownViewHref({ type: "wishlist", status: "fulfilled" })).toBe("/me/posts?type=wishlist&status=fulfilled");
    expect(ownViewHref({ type: "all", status: "all" })).toBe("/me/posts");
  });

  it("counts and filters by type and status, with hidden and removed together", () => {
    const posts = [
      { kind: "showcase", status: "open" },
      { kind: "showcase", status: "fulfilled" },
      { kind: "wishlist", status: "open" },
      { kind: "wishlist", status: "removed" },
      { kind: "wishlist", status: "hidden" },
    ];
    const counts = countOwnPosts(posts);
    expect(counts.all.all).toBe(5);
    expect(counts.wishlist).toMatchObject({ all: 3, open: 1, hidden: 2, fulfilled: 0 });
    expect(counts.showcase).toMatchObject({ all: 2, open: 1, fulfilled: 1 });
    expect(inOwnView(posts, { type: "wishlist", status: "hidden" })).toHaveLength(2);
    expect(inOwnView(posts, { type: "all", status: "open" })).toHaveLength(2);
  });
});
