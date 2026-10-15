import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { image, post, rateLimitEvent, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { listFeed } from "@/lib/discovery/feed";
import { InvalidImageError } from "@/lib/images/process";
import type { ObjectStore } from "@/lib/images/store";
import { createPost } from "@/lib/posts/create";
import { createTestStudent, deleteTestStudent, TEST_SCHOOL } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 8);
const ownerId = `owner-${run}`;
const ownerEmail = `${ownerId}@${TEST_SCHOOL}`;

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

const photo = () =>
  sharp({ create: { width: 640, height: 480, channels: 3, background: "#228844" } })
    .jpeg()
    .toBuffer();

beforeAll(async () => {
  await createTestStudent(ownerId);
});

afterAll(async () => {
  // post_photo rows go with their posts (ON DELETE CASCADE); images after that.
  await db.delete(post).where(eq(post.ownerId, ownerId));
  await db.delete(image).where(eq(image.ownerId, ownerId));
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, ownerId));
  await deleteTestStudent(ownerId);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("createPost", () => {
  it("stores a processed photo and shows the post in the feed without any email", async () => {
    const store = new MemoryStore();
    const { id } = await createPost({
      ownerId,
      input: { kind: "showcase", title: "  Calculus textbook  " },
      photo: await photo(),
      store,
    });

    expect(store.objects.size).toBe(2);
    const feed = await listFeed(100);
    const item = feed.find((entry) => entry.id === id);
    expect(item).toMatchObject({
      title: "Calculus textbook",
      kind: "showcase",
      school: TEST_SCHOOL,
    });
    expect(store.objects.has(item!.thumbKey)).toBe(true);
    expect(JSON.stringify(feed)).not.toContain(ownerEmail);
  });

  it("leaves nothing behind when the file is not an image", async () => {
    const store = new MemoryStore();
    await expect(
      createPost({
        ownerId,
        input: { kind: "wishlist", title: "Bad file" },
        photo: Buffer.from("not an image"),
        store,
      }),
    ).rejects.toBeInstanceOf(InvalidImageError);
    expect(store.objects.size).toBe(0);
    expect(await db.select().from(post).where(eq(post.title, "Bad file"))).toHaveLength(0);
  });

  it("removes the stored photo when the database refuses the post", async () => {
    const store = new MemoryStore();
    await expect(
      createPost({
        ownerId: `missing-${run}`, // no such student: the foreign key refuses it
        input: { kind: "showcase", title: "Orphan" },
        photo: await photo(),
        store,
      }),
    ).rejects.toThrow();
    expect(store.objects.size).toBe(0);
    expect(await db.select().from(image).where(eq(image.ownerId, `missing-${run}`))).toHaveLength(0);
  });

  it("rejects a bad title before touching storage", async () => {
    const store = new MemoryStore();
    await expect(
      createPost({ ownerId, input: { kind: "showcase", title: "   " }, photo: await photo(), store }),
    ).rejects.toThrow();
    expect(store.objects.size).toBe(0);
  });
});

describe("database invariants", () => {
  it("refuses to commit an open post with no photo", async () => {
    await expect(
      db.insert(post).values({ ownerId, kind: "showcase", title: "No photo" }),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/at least one photo/) } });
  });

  it("never lets a post change kind", async () => {
    const store = new MemoryStore();
    const { id } = await createPost({
      ownerId,
      input: { kind: "showcase", title: "Fixed kind" },
      photo: await photo(),
      store,
    });
    await expect(
      db.update(post).set({ kind: "wishlist" }).where(eq(post.id, id)),
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/kind cannot change/) } });
  });

  it("refuses a student row that is not a school address", async () => {
    await expect(
      db.insert(student).values({
        id: `bad-${run}`,
        email: `bad-${run}@gmail.com`,
        schoolDomain: "gmail.com",
      }),
    ).rejects.toMatchObject({ cause: { constraint: "student_email_school" } });
  });
});
