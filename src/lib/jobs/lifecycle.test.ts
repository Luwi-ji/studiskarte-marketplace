import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { availabilityWindow, image, jobRun, post, postPhoto, postView, rateLimitEvent } from "@/db/schema";
import { GET as runJobs } from "@/app/api/jobs/run/route";
import { getDb, getPool } from "@/lib/db";
import { listFeed } from "@/lib/discovery/feed";
import type { ObjectStore } from "@/lib/images/store";
import { cleanupUnusedPhotos } from "@/lib/jobs/cleanup";
import { expirePosts } from "@/lib/jobs/expire-posts";
import { EXPIRED_KEEP_DAYS, purgePosts, WITHDRAWN_KEEP_DAYS } from "@/lib/jobs/purge-posts";
import { isJobName, JOBS, runJob, staleJobs } from "@/lib/jobs/job-run";
import { createPost } from "@/lib/posts/create";
import { getPostDetail } from "@/lib/posts/detail";
import { expiryNotice } from "@/lib/posts/format";
import { OPEN_POSTS_MAX, type NewPostInput } from "@/lib/posts/schema";
import { listOwnPosts } from "@/lib/posts/mine";
import { deletePost, withdrawPost } from "@/lib/posts/transitions";
import { getEditablePost, updatePost } from "@/lib/posts/update";
import { recordView } from "@/lib/posts/views";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `life-a-${run}`;
const viewer = `life-b-${run}`;
const DAY = 24 * 60 * 60 * 1000;

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

async function photoRow(ownerId: string, createdAt = new Date(), purpose = "post_photo"): Promise<string> {
  const name = randomUUID();
  const [row] = await db
    .insert(image)
    .values({ ownerId, purpose, key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1, createdAt })
    .returning({ id: image.id });
  return row.id;
}

let counter = 0;
async function input(overrides: Partial<NewPostInput> = {}): Promise<NewPostInput> {
  counter += 1;
  return {
    kind: "showcase",
    title: `Lifecycle ${run} #${counter}`,
    description: "Lifecycle test post.",
    categoryId: "electronics",
    condition: "used_good",
    priceKind: "amount",
    priceAmount: "100",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([await photoRow(owner)]),
    ...overrides,
  };
}

async function newPost(overrides: Partial<NewPostInput> = {}): Promise<string> {
  const result = await createPost({ ownerId: owner, input: await input(overrides), now: new Date("2026-01-01T00:00:00Z") });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** Makes a post's 30 days run out `daysAgo` days ago (negative: in the future). */
async function ageOut(id: string, daysAgo: number) {
  const expiresAt = new Date(Date.now() - daysAgo * DAY);
  await db.update(post).set({ expiresAt, listedAt: new Date(expiresAt.getTime() - 30 * DAY) }).where(eq(post.id, id));
}

const statusOf = async (id: string) => (await db.select({ s: post.status }).from(post).where(eq(post.id, id)))[0]?.s;

beforeAll(async () => {
  await createTestStudent(owner, { handle: `la_${run}` });
  await createTestStudent(viewer, { handle: `lb_${run}` });
});

afterAll(async () => {
  await db.delete(post).where(inArray(post.ownerId, [owner]));
  await db.delete(image).where(inArray(image.ownerId, [owner, viewer]));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, [owner, viewer]));
  for (const id of [owner, viewer]) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("expiry", () => {
  it("expires an open post whose time passed, leaves others alone, and a second run changes nothing", async () => {
    const old = await newPost();
    const fresh = await newPost();
    await ageOut(old, 1);
    await ageOut(fresh, -10);

    expect(await expirePosts()).toBeGreaterThanOrEqual(1);
    expect(await statusOf(old)).toBe("expired");
    expect(await statusOf(fresh)).toBe("open");
    expect(await expirePosts()).toBe(0);
    expect(await statusOf(old)).toBe("expired");
  });

  it("does not expire a reserved post", async () => {
    const id = await newPost();
    await db.update(post).set({ status: "reserved" }).where(eq(post.id, id));
    await ageOut(id, 5);
    await expirePosts();
    expect(await statusOf(id)).toBe("reserved");
  });

  it("hides a post from others as soon as its time passes, before the job runs", async () => {
    const id = await newPost();
    await ageOut(id, 0.01);
    expect((await listFeed(viewer, { limit: 200 })).items.some((item) => item.id === id)).toBe(false);
    expect(await getPostDetail(viewer, id)).toBeNull();
    expect(await getPostDetail(owner, id)).toMatchObject({ isOwner: true });
  });
});

describe("taking finished posts off the owner's list", () => {
  const store = new MemoryStore();
  const listed = async (id: string) => (await listOwnPosts(owner)).some((p) => p.id === id);
  const deletedAt = async (id: string) => (await db.select({ at: post.ownerDeletedAt }).from(post).where(eq(post.id, id)))[0]?.at ?? null;

  it("purges a withdrawn post after a day and an expired one after a week, keeps the rest, and a second run changes nothing", async () => {
    const now = new Date();
    const freshWithdrawn = await newPost();
    const oldWithdrawn = await newPost();
    const recentlyExpired = await newPost();
    const longExpired = await newPost();
    const open = await newPost();
    const fulfilled = await newPost();
    await db.update(post).set({ status: "withdrawn", updatedAt: new Date(now.getTime() - (WITHDRAWN_KEEP_DAYS * DAY - 60_000)) }).where(eq(post.id, freshWithdrawn));
    await db.update(post).set({ status: "withdrawn", updatedAt: new Date(now.getTime() - (WITHDRAWN_KEEP_DAYS * DAY + 60_000)) }).where(eq(post.id, oldWithdrawn));
    await db.update(post).set({ status: "expired", expiresAt: new Date(now.getTime() - (EXPIRED_KEEP_DAYS * DAY - 60_000)), listedAt: new Date(now.getTime() - 40 * DAY) }).where(eq(post.id, recentlyExpired));
    await db.update(post).set({ status: "expired", expiresAt: new Date(now.getTime() - (EXPIRED_KEEP_DAYS * DAY + 60_000)), listedAt: new Date(now.getTime() - 40 * DAY) }).where(eq(post.id, longExpired));
    await db.update(post).set({ status: "fulfilled", updatedAt: new Date(now.getTime() - 30 * DAY) }).where(eq(post.id, fulfilled));

    expect(await purgePosts(now)).toBeGreaterThanOrEqual(2);
    expect(await listed(oldWithdrawn)).toBe(false);
    expect(await listed(longExpired)).toBe(false);
    for (const id of [freshWithdrawn, recentlyExpired, open, fulfilled]) expect(await listed(id)).toBe(true);
    expect(await purgePosts(now)).toBe(0);
  });

  it("lets an expired post be relisted before the week is up, and then never purges it", async () => {
    const id = await newPost();
    await ageOut(id, EXPIRED_KEEP_DAYS - 1);
    await expirePosts();
    expect(await statusOf(id)).toBe("expired");
    await purgePosts();
    expect(await listed(id)).toBe(true);

    const relisted = await updatePost({ ownerId: owner, postId: id, store, relist: true, input: await input({ photos: photosOf([await photoRow(owner)]) }) });
    expect(relisted.ok).toBe(true);
    await purgePosts(new Date(Date.now() + 60 * DAY));
    expect(await statusOf(id)).toBe("open");
    expect(await listed(id)).toBe(true);
  });

  it("lets the owner delete a withdrawn or expired post, and nothing else", async () => {
    const withdrawn = await newPost();
    expect(await withdrawPost(owner, withdrawn)).toBe("ok");
    const expired = await newPost();
    await ageOut(expired, 1);
    await expirePosts();
    const open = await newPost();
    const fulfilled = await newPost();
    await db.update(post).set({ status: "fulfilled" }).where(eq(post.id, fulfilled));

    expect(await deletePost(viewer, withdrawn)).toBe("not_available");
    expect(await deletePost(owner, open)).toBe("not_available");
    expect(await deletePost(owner, fulfilled)).toBe("not_available");
    expect(await deletePost(owner, withdrawn)).toBe("ok");
    expect(await deletePost(owner, expired)).toBe("ok");
    expect(await deletePost(owner, expired)).toBe("not_available");
    expect(await listed(withdrawn)).toBe(false);
    expect(await listed(expired)).toBe(false);
    expect(await deletedAt(withdrawn)).not.toBeNull();
    expect(await statusOf(withdrawn)).toBe("withdrawn");
    for (const id of [open, fulfilled]) expect(await listed(id)).toBe(true);
    // A deleted post cannot be relisted.
    const relist = await updatePost({ ownerId: owner, postId: expired, store, relist: true, input: await input({ photos: photosOf([await photoRow(owner)]) }) });
    expect(relist.ok).toBe(false);
  });
});

describe("expiry notice", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  it.each([
    [10, "Expires in 10 days", false],
    [4, "Expires in 4 days", false],
    [3, "Expires in 3 days", true],
    [1, "Expires tomorrow", true],
    [0.2, "Expires tomorrow", true],
    [0, "Expires today", true],
  ])("%s days left reads %j (warn: %s)", (days, text, warn) => {
    expect(expiryNotice(new Date(now.getTime() + (days as number) * DAY), now)).toEqual({ text, warn });
  });
});

describe("relist", () => {
  const store = new MemoryStore();

  it("lists an expired post again for 30 days, keeping its photos, views and details", async () => {
    const id = await newPost();
    await recordView(viewer, id);
    await ageOut(id, 2);
    await expirePosts();
    expect(await statusOf(id)).toBe("expired");

    const editable = await getEditablePost(owner, id);
    expect(editable?.relist).toBe(true);
    expect(editable?.availability).toHaveLength(1);

    const before = Date.now();
    const result = await updatePost({
      ownerId: owner,
      postId: id,
      store,
      relist: true,
      input: { ...(await input()), title: `Relisted ${run}`, photos: editable!.photos.map((p) => ({ id: p.id, caption: p.caption ?? "" })) },
    });
    expect(result).toEqual({ ok: true, id });
    const [row] = await db.select().from(post).where(eq(post.id, id));
    expect(row.status).toBe("open");
    expect(row.title).toBe(`Relisted ${run}`);
    expect(row.listedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.expiresAt.getTime() - row.listedAt.getTime()).toBe(30 * DAY);
    expect(await db.select().from(postView).where(eq(postView.postId, id))).toHaveLength(1);
    expect((await listFeed(viewer, { limit: 200 })).items.some((item) => item.id === id)).toBe(true);
  });

  it("leaves out dates that have passed when relisting", async () => {
    const id = await newPost();
    await db.insert(availabilityWindow).values({ postId: id, kind: "date", onDate: "2000-01-01", startTime: "09:00", endTime: "10:00" });
    await ageOut(id, 1);
    await expirePosts();
    const editable = await getEditablePost(owner, id);
    expect(editable?.availability.some((a) => a.kind === "date" && a.date === "2000-01-01")).toBe(false);
  });

  it("refuses to relist a post that is open, someone else's, or withdrawn", async () => {
    const open = await newPost();
    const attempt = async (ownerId: string, id: string) =>
      updatePost({ ownerId, postId: id, store, relist: true, input: await input({ photos: photosOf([await photoRow(ownerId)]) }) });
    expect((await attempt(owner, open)).ok).toBe(false);

    await ageOut(open, 1);
    await expirePosts();
    expect((await attempt(viewer, open)).ok).toBe(false);

    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, open));
    expect((await attempt(owner, open)).ok).toBe(false);
  });

  it("counts against the open-post limit, even when two relist at the same moment", async () => {
    const student = `life-limit-${run}`;
    await createTestStudent(student, { handle: `ll_${run}` });
    try {
      const [a, b] = await db.transaction(async (tx) => {
        const n = OPEN_POSTS_MAX - 1;
        const imgs = await tx
          .insert(image)
          .values(Array.from({ length: n + 2 }, (_, i) => ({ ownerId: student, purpose: "post_photo", key: `l/${student}/${i}`, thumbKey: `l/${student}/${i}-t`, width: 1, height: 1, bytes: 1 })))
          .returning({ id: image.id });
        const rows = await tx
          .insert(post)
          .values(
            Array.from({ length: n + 2 }, (_, i) => ({
              ownerId: student,
              kind: "showcase",
              title: `Seed ${i}`,
              description: "Seeded.",
              categoryId: "other",
              priceKind: "free",
              exchangeMeetup: true,
              exchangeDelivery: false,
              meetupLocation: "Gate",
              status: i < n ? "open" : "expired",
            })),
          )
          .returning({ id: post.id });
        await tx.insert(postPhoto).values(rows.map((r, i) => ({ postId: r.id, imageId: imgs[i].id, position: 0 })));
        await tx.insert(availabilityWindow).values(rows.map((r) => ({ postId: r.id, kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" })));
        return [rows[n], rows[n + 1]];
      });
      const relist = async (id: string) => {
        const editable = await getEditablePost(student, id);
        return updatePost({
          ownerId: student,
          postId: id,
          store,
          relist: true,
          input: { ...(await input()), title: `Seed ${id}`, categoryId: "other", condition: null, priceKind: "free", priceAmount: "", photos: editable!.photos.map((p) => ({ id: p.id, caption: "" })) },
        });
      };
      const results = await Promise.all([relist(a.id), relist(b.id)]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({ errors: { form: expect.stringContaining(`${OPEN_POSTS_MAX}`) } });
    } finally {
      await db.delete(post).where(eq(post.ownerId, student));
      await db.delete(image).where(eq(image.ownerId, student));
      await deleteTestStudent(student);
    }
  });
});

describe("views", () => {
  const day1 = new Date("2026-10-16T10:00:00Z");
  const day2 = new Date("2026-10-17T10:00:00Z");

  it("counts a student once per day, again the next day, and never the owner", async () => {
    const id = await newPost();
    expect(await recordView(viewer, id, day1)).toBe(true);
    expect(await recordView(viewer, id, day1)).toBe(false);
    expect(await recordView(owner, id, day1)).toBe(false);
    expect(await recordView(viewer, id, day2)).toBe(true);
    expect((await getPostDetail(owner, id))?.viewCount).toBe(2);
  });

  it("uses the Manila day: 23:30 UTC is already the next day there", async () => {
    const id = await newPost();
    expect(await recordView(viewer, id, new Date("2026-10-16T15:00:00Z"))).toBe(true); // 23:00 Oct 16 Manila
    expect(await recordView(viewer, id, new Date("2026-10-16T17:00:00Z"))).toBe(true); // 01:00 Oct 17 Manila
  });

  it("shows the count only to the owner", async () => {
    const id = await newPost();
    await recordView(viewer, id, day1);
    expect((await getPostDetail(viewer, id))?.viewCount).toBeNull();
    expect((await getPostDetail(owner, id))?.viewCount).toBe(1);
  });

  it("does not count a post others cannot see", async () => {
    const id = await newPost();
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, id));
    expect(await recordView(viewer, id, day1)).toBe(false);
  });
});

describe("cleanup of unused photos", () => {
  it("removes old unused post photos from the database and storage, and nothing else", async () => {
    const store = new MemoryStore();
    const old = new Date(Date.now() - 2 * DAY);
    const unusedOld = await photoRow(owner, old);
    const unusedYoung = await photoRow(owner, new Date());
    const avatarOld = await photoRow(owner, old, "avatar");
    const onPost = await photoRow(owner, old);
    await newPost({ photos: photosOf([onPost]) });
    for (const id of [unusedOld, unusedYoung, avatarOld, onPost]) {
      const [row] = await db.select().from(image).where(eq(image.id, id));
      store.objects.set(row.key, Buffer.from("x"));
      store.objects.set(row.thumbKey, Buffer.from("x"));
    }

    expect(await cleanupUnusedPhotos(store)).toBeGreaterThanOrEqual(1);
    const remaining = (await db.select({ id: image.id }).from(image).where(inArray(image.id, [unusedOld, unusedYoung, avatarOld, onPost]))).map((r) => r.id);
    expect(remaining.sort()).toEqual([unusedYoung, avatarOld, onPost].sort());
    expect(store.objects.size).toBe(6);
    expect(await cleanupUnusedPhotos(store)).toBe(0);
  });
});

describe("job runs and the scheduler check", () => {
  const originalRows = async () => db.select().from(jobRun);

  it("records a successful and a failed run", async () => {
    await runJob("expire-posts", async () => "expired 0 posts");
    expect((await db.select().from(jobRun).where(eq(jobRun.name, "expire-posts")))[0]).toMatchObject({ lastStatus: "ok", lastDetail: "expired 0 posts" });
    await expect(runJob("cleanup", async () => Promise.reject(new Error("storage down")))).rejects.toThrow("storage down");
    expect((await db.select().from(jobRun).where(eq(jobRun.name, "cleanup")))[0]).toMatchObject({ lastStatus: "failed", lastDetail: "storage down" });
  });

  it("flags a stopped scheduler: never ran, too old, or last run failed", async () => {
    const saved = await originalRows();
    try {
      await db.delete(jobRun);
      const names = Object.keys(JOBS).filter(isJobName);
      // Frequent jobs go stale after a few hours; daily ones (cleanup, review reminders) have longer.
      const frequent = names.filter((name) => JOBS[name].maxAgeMinutes <= JOBS["expire-posts"].maxAgeMinutes);
      const daily = names.filter((name) => !frequent.includes(name));
      expect((await staleJobs()).map((j) => [j.name, j.reason])).toEqual(expect.arrayContaining(names.map((name) => [name, "never_ran"])));

      for (const name of names) await runJob(name, async () => "ok");
      expect(await staleJobs()).toEqual([]);

      // Past the frequent jobs' limit, only they are stale.
      const later = new Date(Date.now() + (JOBS["expire-posts"].maxAgeMinutes + 5) * 60_000);
      expect((await staleJobs(later)).map((j) => [j.name, j.reason])).toEqual(expect.arrayContaining(frequent.map((name) => [name, "too_old"])));
      for (const name of daily) expect((await staleJobs(later)).map((j) => j.name)).not.toContain(name);

      await expect(runJob("cleanup", async () => Promise.reject(new Error("boom")))).rejects.toThrow();
      expect((await staleJobs()).map((j) => [j.name, j.reason])).toEqual([["cleanup", "last_failed"]]);
    } finally {
      await db.delete(jobRun);
      if (saved.length > 0) await db.insert(jobRun).values(saved);
    }
  });
});

describe("jobs endpoint", () => {
  const secret = "test-secret-0123456789abcdef";
  const call = (path: string, auth?: string) =>
    runJobs(new Request(`http://localhost:3000/api/jobs/run${path}`, { headers: auth ? { authorization: auth } : {} }));

  it("refuses everyone without the exact secret, and everyone when no secret is set", async () => {
    process.env.CRON_SECRET = secret;
    expect((await call("?job=expire-posts")).status).toBe(401);
    expect((await call("?job=expire-posts", "Bearer wrong")).status).toBe(401);
    expect((await call("?job=expire-posts", `Bearer ${secret}x`)).status).toBe(401);
    expect((await call("?job=expire-posts", secret)).status).toBe(401);

    delete process.env.CRON_SECRET;
    expect((await call("?job=expire-posts", "Bearer ")).status).toBe(401);
    process.env.CRON_SECRET = "short";
    expect((await call("?job=expire-posts", "Bearer short")).status).toBe(401);
  });

  it("runs a named job for the right secret and rejects an unknown job", async () => {
    process.env.CRON_SECRET = secret;
    const ok = await call("?job=expire-posts", `Bearer ${secret}`);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ results: { "expire-posts": expect.stringMatching(/^expired \d+ posts$/) } });
    expect((await call("?job=drop-tables", `Bearer ${secret}`)).status).toBe(400);
  });
});
