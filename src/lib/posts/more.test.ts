import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { image, post } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import { listMoreLikeThis, moreContext, type MoreItem } from "@/lib/posts/more";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `more-s-${run}`;
const other = `more-o-${run}`;
const viewer = `more-v-${run}`;
const all = [seller, other, viewer];

async function newPost(ownerId: string, title: string, categoryId: string, listedAt: string, status = "open"): Promise<string> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `${title} ${run}`,
    description: "More-listings test post.",
    categoryId,
    condition: null,
    priceKind: "free",
    priceAmount: "",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  // listed_at is given as text so the time is exact.
  await db
    .update(post)
    .set({ listedAt: sql`${listedAt}::timestamptz`, expiresAt: sql`now() + interval '20 days'`, status })
    .where(eq(post.id, result.id));
  return result.id;
}

let current: string, sNew: string, sOld: string, sOtherCategory: string, sHidden: string;
let oNew: string, oOld: string, oOtherCategory: string, oWithdrawn: string;

beforeAll(async () => {
  await createTestStudent(seller, { handle: `ms_${run}` });
  await createTestStudent(other, { handle: `mo_${run}` });
  await createTestStudent(viewer, { handle: `mv_${run}` });
  current = await newPost(seller, "Current", "other", "2026-01-05T00:00:00Z");
  sOld = await newPost(seller, "Seller old", "other", "2026-01-01T00:00:00Z");
  sNew = await newPost(seller, "Seller new", "other", "2026-01-04T00:00:00Z");
  sOtherCategory = await newPost(seller, "Seller services", "services", "2026-01-03T00:00:00Z");
  sHidden = await newPost(seller, "Seller hidden", "other", "2026-01-06T00:00:00Z", "hidden");
  oOld = await newPost(other, "Other old", "other", "2026-01-02T00:00:00Z");
  oNew = await newPost(other, "Other new", "other", "2026-01-07T00:00:00Z");
  oOtherCategory = await newPost(other, "Other services", "services", "2026-01-08T00:00:00Z");
  oWithdrawn = await newPost(other, "Other withdrawn", "other", "2026-01-09T00:00:00Z", "withdrawn");
});

afterAll(async () => {
  await db.delete(post).where(inArray(post.ownerId, all));
  await db.delete(image).where(inArray(image.ownerId, all));
  for (const id of all) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

/** The test's own posts, so posts other test files leave in the same category do not matter. */
const mine = () => [current, sNew, sOld, sOtherCategory, sHidden, oNew, oOld, oOtherCategory, oWithdrawn];

/** Reads the whole list in pages of `size`, as "Show more" would. */
async function walk(size: number): Promise<MoreItem[]> {
  const context = await moreContext(viewer, current);
  if (!context) throw new Error("the viewer cannot see the post");
  const seen: MoreItem[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 500; guard++) {
    const page = await listMoreLikeThis(viewer, context, { cursor, limit: size });
    seen.push(...page.items);
    cursor = page.nextCursor;
    if (!cursor) break;
  }
  return seen;
}

const ownIds = (items: MoreItem[]) => items.map((i) => i.id).filter((id) => mine().includes(id));

describe("more listings under a post", () => {
  it("lists the seller's other listings first, then the category's, each newest first", async () => {
    expect(ownIds(await walk(500))).toEqual([sNew, sOtherCategory, sOld, oNew, oOld]);
  });

  it("marks which group each listing belongs to", async () => {
    const items = (await walk(500)).filter((i) => mine().includes(i.id));
    expect(items.map((i) => i.group)).toEqual([0, 0, 0, 1, 1]);
  });

  it("never shows the post itself, hidden or withdrawn posts, or another category's posts", async () => {
    const ids = ownIds(await walk(500));
    for (const missing of [current, sHidden, oWithdrawn, oOtherCategory]) expect(ids).not.toContain(missing);
  });

  it("gives the same order in small pages, with no repeats", async () => {
    const small = await walk(2);
    expect(new Set(small.map((i) => i.id)).size).toBe(small.length);
    expect(ownIds(small)).toEqual(ownIds(await walk(500)));
  });

  it("gives no context for a post the viewer may not see", async () => {
    expect(await moreContext(viewer, sHidden)).toBeNull();
  });
});
