import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availabilityWindow, image, post, postPhoto, rateLimitEvent } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { listFeed } from "@/lib/discovery/feed";
import { InvalidImageError } from "@/lib/images/process";
import type { ObjectStore } from "@/lib/images/store";
import { storeImage } from "@/lib/images/upload";
import { createPost } from "@/lib/posts/create";
import { OPEN_POSTS_MAX, type NewPostInput } from "@/lib/posts/schema";
import { withdrawPost } from "@/lib/posts/transitions";
import { getEditablePost, updatePost } from "@/lib/posts/update";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `post-a-${run}`;
const other = `post-b-${run}`;
let ownerEmail = "";

class MemoryStore implements ObjectStore {
  objects = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.objects.set(key, body);
  }
  async delete(keys: string[]) {
    for (const key of keys) this.objects.delete(key);
  }
  async signedUrl(key: string) {
    return `memory://${key}`;
  }
}

/** An uploaded, not yet attached post photo (row only; storage is not needed here). */
async function photoOf(ownerId: string): Promise<string> {
  const name = randomUUID();
  const [row] = await db
    .insert(image)
    .values({
      ownerId,
      purpose: "post_photo",
      key: `test/${name}.webp`,
      thumbKey: `test/${name}-thumb.webp`,
      width: 10,
      height: 10,
      bytes: 10,
    })
    .returning({ id: image.id });
  return row.id;
}

let titleCounter = 0;
async function input(overrides: Partial<NewPostInput> = {}): Promise<NewPostInput> {
  titleCounter += 1;
  return {
    kind: "showcase",
    title: `Calculator ${run} #${titleCounter}`,
    description: "Casio fx-991ES, complete with cover.",
    categoryId: "electronics",
    condition: "used_good",
    priceKind: "amount",
    priceAmount: "1200",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Main gate",
    deliveryArea: "",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "12:00" }],
    photos: photosOf([await photoOf(owner)]),
    ...overrides,
  };
}

async function created(overrides: Partial<NewPostInput> = {}): Promise<string> {
  const result = await createPost({ ownerId: owner, input: await input(overrides) });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

beforeAll(async () => {
  ownerEmail = (await createTestStudent(owner, { handle: `pa_${run}` })).email;
  await createTestStudent(other, { handle: `pb_${run}` });
});

afterAll(async () => {
  const ids = [owner, other];
  await db.delete(post).where(inArray(post.ownerId, ids));
  await db.delete(image).where(inArray(image.ownerId, ids));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, ids));
  for (const id of ids) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("createPost", () => {
  it("creates a complete post that shows in the feed with its price, and no email", async () => {
    const id = await created({ priceAmount: "₱1,500" });
    const feed = (await listFeed(owner, { limit: 200 })).items;
    expect(feed.find((item) => item.id === id)).toMatchObject({ priceKind: "amount", priceAmount: 1500, ownerHandle: `pa_${run}` });
    expect(JSON.stringify(feed)).not.toContain(ownerEmail);
    const windows = await db.select().from(availabilityWindow).where(eq(availabilityWindow.postId, id));
    expect(windows).toHaveLength(1);
  });

  it("keeps photos in the order given", async () => {
    const photos = [await photoOf(owner), await photoOf(owner), await photoOf(owner)];
    const id = await created({ photos: photosOf(photos) });
    const rows = await db.select().from(postPhoto).where(eq(postPhoto.postId, id)).orderBy(postPhoto.position);
    expect(rows.map((row) => row.imageId)).toEqual(photos);
  });

  it("refuses another student's photo, and a photo already on a post", async () => {
    const stranger = await createPost({ ownerId: owner, input: await input({ photos: photosOf([await photoOf(other)]) }) });
    expect(stranger).toMatchObject({ ok: false, errors: { photos: expect.any(String) } });

    const shared = await photoOf(owner);
    await created({ photos: photosOf([shared]) });
    const reused = await createPost({ ownerId: owner, input: await input({ photos: photosOf([shared]) }) });
    expect(reused).toMatchObject({ ok: false, errors: { photos: expect.any(String) } });
  });

  it("refuses the same post twice while it is open", async () => {
    const first = await input({ title: `Twin ${run}` });
    await createPost({ ownerId: owner, input: first });
    const again = await createPost({ ownerId: owner, input: { ...(await input()), title: ` twin ${run} `, description: first.description } });
    expect(again).toMatchObject({ ok: false, errors: { form: expect.stringContaining("already") } });
  });

  it("returns field errors and writes nothing for bad input", async () => {
    const before = await db.select({ id: post.id }).from(post).where(eq(post.ownerId, owner));
    const result = await createPost({ ownerId: owner, input: await input({ priceAmount: "-5", meetupLocation: "" }) });
    expect(result).toMatchObject({ ok: false, errors: { priceAmount: expect.any(String), meetupLocation: expect.any(String) } });
    expect(await db.select({ id: post.id }).from(post).where(eq(post.ownerId, owner))).toHaveLength(before.length);
  });
});

describe("open-post limit", () => {
  it(`allows ${OPEN_POSTS_MAX} open posts, even when several are created at the same moment`, async () => {
    const student = `post-limit-${run}`;
    await createTestStudent(student, { handle: `pl_${run}` });
    try {
      // The first 19 are written directly in one transaction; the code under
      // test is the limit check when the last ones arrive at the same moment.
      await db.transaction(async (tx) => {
        const n = OPEN_POSTS_MAX - 1;
        const images = await tx
          .insert(image)
          .values(Array.from({ length: n }, (_, i) => ({ ownerId: student, purpose: "post_photo", key: `t/${student}/${i}`, thumbKey: `t/${student}/${i}-t`, width: 1, height: 1, bytes: 1 })))
          .returning({ id: image.id });
        const posts = await tx
          .insert(post)
          .values(Array.from({ length: n }, (_, i) => ({ ownerId: student, kind: "showcase", title: `Seed ${i}`, description: "Seeded.", categoryId: "other", priceKind: "free", exchangeMeetup: true, exchangeDelivery: false, meetupLocation: "Gate" })))
          .returning({ id: post.id });
        await tx.insert(postPhoto).values(posts.map((p, i) => ({ postId: p.id, imageId: images[i].id, position: 0 })));
        await tx.insert(availabilityWindow).values(posts.map((p) => ({ postId: p.id, kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" })));
      });
      const make = async (n: number) => {
        const [row] = await db
          .insert(image)
          .values({ ownerId: student, purpose: "post_photo", key: `t/${student}/${n}`, thumbKey: `t/${student}/${n}-t`, width: 1, height: 1, bytes: 1 })
          .returning({ id: image.id });
        return createPost({ ownerId: student, input: { ...(await input()), title: `Limit ${n}`, photos: photosOf([row.id]) } });
      };
      // Several at once so the transactions really overlap.
      const race = await Promise.all([100, 101, 102, 103, 104, 105].map(make));
      expect(race.filter((r) => r.ok)).toHaveLength(1);
      expect(race.find((r) => !r.ok)).toMatchObject({ errors: { form: expect.stringContaining(`${OPEN_POSTS_MAX}`) } });
    } finally {
      await db.delete(post).where(eq(post.ownerId, student));
      await db.delete(image).where(eq(image.ownerId, student));
      await deleteTestStudent(student);
    }
  });
});

describe("updatePost and withdrawPost", () => {
  it("edits fields, replaces photos, and deletes the photos taken off", async () => {
    const store = new MemoryStore();
    const keep = await storeImage({ ownerId: owner, bytes: await tinyJpeg(), purpose: "post_photo", store });
    const drop = await storeImage({ ownerId: owner, bytes: await tinyJpeg(), purpose: "post_photo", store });
    const id = await created({ photos: photosOf([keep.id, drop.id]) });

    const result = await updatePost({
      ownerId: owner,
      postId: id,
      store,
      input: { ...(await input()), title: `Edited ${run}`, priceKind: "free", priceAmount: "", photos: photosOf([keep.id]) },
    });
    expect(result).toEqual({ ok: true, id });
    const editable = await getEditablePost(owner, id);
    expect(editable?.post).toMatchObject({ title: `Edited ${run}`, priceKind: "free", priceAmount: null, kind: "showcase" });
    expect(editable?.photos.map((p) => p.id)).toEqual([keep.id]);
    expect(store.objects.has(drop.keys[0])).toBe(false);
    expect(store.objects.has(keep.keys[0])).toBe(true);
  });

  it("saves photo captions and changes them on edit", async () => {
    const [a, b] = [await photoOf(owner), await photoOf(owner)];
    const id = await created({ photos: [{ id: a, caption: "Front" }, { id: b, caption: "" }] });
    const before = await db.select({ imageId: postPhoto.imageId, caption: postPhoto.caption }).from(postPhoto).where(eq(postPhoto.postId, id)).orderBy(postPhoto.position);
    expect(before).toEqual([{ imageId: a, caption: "Front" }, { imageId: b, caption: null }]);

    const store = new MemoryStore();
    await updatePost({ ownerId: owner, postId: id, store, input: { ...(await input()), photos: [{ id: b, caption: "Back" }, { id: a, caption: "" }] } });
    expect((await getEditablePost(owner, id))?.photos.map((p) => [p.id, p.caption])).toEqual([[b, "Back"], [a, null]]);
  });

  it("refuses a blank caption written straight to the database", async () => {
    const id = await created();
    await expect(db.update(postPhoto).set({ caption: "   " }).where(eq(postPhoto.postId, id))).rejects.toMatchObject({
      cause: { constraint: "post_photo_caption_length" },
    });
  });

  it("lets only the owner edit or withdraw, and only while open", async () => {
    const id = await created();
    const store = new MemoryStore();
    expect((await updatePost({ ownerId: other, postId: id, store, input: await input() })).ok).toBe(false);
    expect(await withdrawPost(other, id)).toBe("not_available");

    expect(await withdrawPost(owner, id)).toBe("ok");
    expect(await withdrawPost(owner, id)).toBe("not_available");
    expect((await updatePost({ ownerId: owner, postId: id, store, input: await input() })).ok).toBe(false);
    expect((await listFeed(owner, { limit: 200 })).items.some((item) => item.id === id)).toBe(false);
  });
});

describe("failed uploads", () => {
  it("store nothing when the file is not an image", async () => {
    const store = new MemoryStore();
    await expect(
      storeImage({ ownerId: owner, bytes: Buffer.from("not an image"), purpose: "post_photo", store }),
    ).rejects.toBeInstanceOf(InvalidImageError);
    expect(store.objects.size).toBe(0);
  });
});

describe("database rules (exit check: bad input is refused even if the app is bypassed)", () => {
  const base = () => ({
    ownerId: owner,
    kind: "showcase",
    title: `Direct ${randomUUID()}`,
    description: "Written straight to the database.",
    categoryId: "electronics",
    condition: "used_good" as string | null,
    priceKind: "amount",
    priceAmount: 100 as number | null,
    paymentCash: true as boolean,
    paymentNote: null as string | null,
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate" as string | null,
    deliveryArea: null as string | null,
  });

  /** Inserts a post with a photo and a window in one transaction, so only the rule under test can fail. */
  async function insertDirect(values: ReturnType<typeof base>, withPhoto = true, withWindow = true) {
    const photo = withPhoto ? await photoOf(owner) : null;
    await db.transaction(async (tx) => {
      const [row] = await tx.insert(post).values(values).returning({ id: post.id });
      if (photo) await tx.insert(postPhoto).values({ postId: row.id, imageId: photo, position: 0 });
      if (withWindow) {
        await tx.insert(availabilityWindow).values({ postId: row.id, kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" });
      }
    });
  }

  const refused = (pattern: RegExp) => ({ cause: { message: expect.stringMatching(pattern) } });

  it("accepts a valid direct insert (control)", async () => {
    await expect(insertDirect(base())).resolves.toBeUndefined();
  });

  it.each([
    ["no photo", (v: ReturnType<typeof base>) => v, false, true, /at least one photo/],
    ["no availability window", (v: ReturnType<typeof base>) => v, true, false, /availability window/],
  ])("refuses a post with %s", async (_label, change, withPhoto, withWindow, pattern) => {
    await expect(insertDirect(change(base()), withPhoto, withWindow)).rejects.toMatchObject(refused(pattern));
  });

  it.each([
    ["a zero amount", { priceAmount: 0 }, "post_price"],
    ["a negative amount", { priceAmount: -1 }, "post_price"],
    ["an amount kind with no amount", { priceAmount: null }, "post_price"],
    ["free with an amount", { priceKind: "free", priceAmount: 5, paymentCash: false }, "post_price"],
    ["a price but no way to pay", { paymentCash: false }, "post_payment_modes"],
    ["free but taking cash", { priceKind: "free", priceAmount: null, paymentCash: true }, "post_payment_modes"],
    ["a payment note with cash only", { paymentNote: "GCash" }, "post_payment_note"],
    ["meet-up without a place", { meetupLocation: null }, "post_meetup_location"],
    ["a blank meet-up place", { meetupLocation: "   " }, "post_meetup_location"],
    ["delivery without an area", { exchangeDelivery: true, deliveryArea: null }, "post_delivery_area"],
    ["no exchange option", { exchangeMeetup: false, meetupLocation: null }, "post_exchange_any"],
    ["an unknown condition", { condition: "broken" }, "post_condition_value"],
    ["a blank description", { description: " " }, "post_description_length"],
  ])("refuses %s", async (_label, change, constraint) => {
    await expect(insertDirect({ ...base(), ...change })).rejects.toMatchObject({ cause: { constraint } });
  });

  it.each([
    ["a weekly entry with no weekday", { kind: "weekly", weekday: null, onDate: null }],
    ["a weekly entry with a date too", { kind: "weekly", weekday: 1, onDate: "2099-01-01" }],
    ["a date entry with no date", { kind: "date", weekday: null, onDate: null }],
    ["a weekday of 7", { kind: "weekly", weekday: 7, onDate: null }],
    ["an unknown kind", { kind: "monthly", weekday: 1, onDate: null }],
  ])("refuses an availability entry with %s", async (_label, change) => {
    const id = await created();
    await expect(
      db.insert(availabilityWindow).values({ postId: id, startTime: "09:00", endTime: "10:00", ...change }),
    ).rejects.toMatchObject({ cause: { constraint: "availability_window_kind" } });
  });

  it("refuses an availability entry that ends before it starts, or lists a day twice", async () => {
    const id = await created();
    await expect(
      db.insert(availabilityWindow).values({ postId: id, kind: "weekly", weekday: 2, startTime: "10:00", endTime: "09:00" }),
    ).rejects.toMatchObject({ cause: { constraint: "availability_window_order" } });
    await expect(
      db.insert(availabilityWindow).values({ postId: id, kind: "weekly", weekday: 1, startTime: "13:00", endTime: "14:00" }),
    ).rejects.toMatchObject({ cause: { constraint: "availability_window_weekday" } });
  });

  it.each([
    ["a condition for a category that has none", { categoryId: "services", condition: "new" }, /takes no condition/],
    ["no condition where one is needed", { condition: null }, /needs a condition/],
    ["an unknown category", { categoryId: "no-such-category" }, /unknown category/],
  ])("refuses %s", async (_label, change, pattern) => {
    await expect(insertDirect({ ...base(), ...change })).rejects.toMatchObject(refused(pattern));
  });
});

function tinyJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: "#228844" } }).jpeg().toBuffer();
}
