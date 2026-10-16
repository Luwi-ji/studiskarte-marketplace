import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { image, post } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { listFeed, type FeedItem } from "@/lib/discovery/feed";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { followStudent } from "@/lib/social/follow";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const fan = `feed-f-${run}`; // follows starA
const loner = `feed-l-${run}`; // follows nobody
const starA = `feed-a-${run}`;
const starB = `feed-b-${run}`;
const all = [fan, loner, starA, starB];

async function newPost(ownerId: string, title: string, listedAt: string): Promise<string> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `${title} ${run}`,
    description: "Feed test post.",
    categoryId: "other",
    condition: null,
    priceKind: "free",
    priceAmount: "",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    deliveryArea: "",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  // listed_at is given as text so the microseconds are exact.
  await db
    .update(post)
    .set({ listedAt: sql`${listedAt}::timestamptz`, expiresAt: sql`now() + interval '20 days'` })
    .where(eq(post.id, result.id));
  return result.id;
}

/** Reads the whole feed in pages of `size`, as the "Show more" button would. */
async function walk(viewerId: string, size: number, between?: () => Promise<void>): Promise<FeedItem[]> {
  const seen: FeedItem[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 500; guard++) {
    const page = await listFeed(viewerId, { cursor, limit: size });
    seen.push(...page.items);
    cursor = page.nextCursor;
    if (!cursor) break;
    await between?.();
    between = undefined;
  }
  return seen;
}

const idsOf = (items: FeedItem[], wanted: string[]) => items.map((i) => i.id).filter((id) => wanted.includes(id));

let fNew: string, fOld: string, nNew: string, nOld: string;

beforeAll(async () => {
  for (const id of all) await createTestStudent(id, { handle: `f${id.slice(5, 6)}_${run}` });
  await followStudent(fan, starA);
  fOld = await newPost(starA, "Followed old", "2026-01-01T00:00:00Z");
  fNew = await newPost(starA, "Followed new", "2026-01-02T12:00:00Z");
  nOld = await newPost(starB, "Other old", "2026-01-02T00:00:00Z");
  nNew = await newPost(starB, "Other new", "2026-01-03T00:00:00Z");
});

afterAll(async () => {
  await db.delete(post).where(inArray(post.ownerId, all));
  await db.delete(image).where(inArray(image.ownerId, all));
  for (const id of all) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("feed order", () => {
  it("puts followed students first, then everyone, each newest first", async () => {
    const feed = (await listFeed(fan, { limit: 500 })).items;
    expect(idsOf(feed, [fNew, fOld, nNew, nOld])).toEqual([fNew, fOld, nNew, nOld]);
  });

  it("shows newest first to someone who follows nobody", async () => {
    const feed = (await listFeed(loner, { limit: 500 })).items;
    expect(idsOf(feed, [fNew, fOld, nNew, nOld])).toEqual([nNew, fNew, nOld, fOld]);
  });

  it("never lists a withdrawn or expired post", async () => {
    const gone = await newPost(starB, "Gone", "2026-01-04T00:00:00Z");
    const lapsed = await newPost(starB, "Lapsed", "2026-01-04T00:00:00Z");
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, gone));
    await db.update(post).set({ expiresAt: sql`now() - interval '1 minute'`, listedAt: sql`now() - interval '31 days'` }).where(eq(post.id, lapsed));
    expect(idsOf((await listFeed(fan, { limit: 500 })).items, [gone, lapsed])).toEqual([]);
  });
});

describe("pages", () => {
  it("reads the same list page by page as in one go, with nothing repeated or skipped", async () => {
    const whole = (await listFeed(fan, { limit: 500 })).items.map((i) => i.id);
    for (const size of [1, 2, 3]) {
      const paged = (await walk(fan, size)).map((i) => i.id);
      expect(new Set(paged).size).toBe(paged.length);
      expect(paged).toEqual(whole);
    }
  });

  it("keeps posts listed in the same millisecond apart, down to the microsecond", async () => {
    const a = await newPost(starB, "Micro a", "2026-01-05T00:00:00.123456Z");
    const b = await newPost(starB, "Micro b", "2026-01-05T00:00:00.123789Z");
    const paged = (await walk(loner, 1)).map((i) => i.id);
    expect(new Set(paged).size).toBe(paged.length);
    expect(idsOf(await walk(loner, 1), [a, b])).toEqual([b, a]);
  });

  it("does not repeat or skip a post when a newer one is listed between pages", async () => {
    const paged = await walk(fan, 2, async () => {
      await newPost(starA, "Arrived while scrolling", new Date().toISOString());
    });
    const ids = paged.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(idsOf(paged, [fNew, fOld, nNew, nOld])).toEqual([fNew, fOld, nNew, nOld]);
  });

  it("says when there is nothing more, and starts over on an unreadable cursor", async () => {
    const last = await listFeed(fan, { limit: 500 });
    expect(last.nextCursor).toBeNull();
    const first = await listFeed(fan, { limit: 2 });
    expect(first.nextCursor).not.toBeNull();
    for (const junk of ["", "not-a-cursor", Buffer.from('{"f":9,"t":"x","id":"y"}').toString("base64url"), "A".repeat(500)]) {
      expect((await listFeed(fan, { limit: 2, cursor: junk })).items.map((i) => i.id)).toEqual(first.items.map((i) => i.id));
    }
  });
});
