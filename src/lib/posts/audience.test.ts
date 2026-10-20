import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { conversation, image, offer, post, rateLimitEvent } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { makeOffer } from "@/lib/deals/offers";
import { startConversation } from "@/lib/messaging/send";
import { audienceRefusal, SHOWCASE_STUDENTS_ONLY, STUDENTS_ONLY } from "@/lib/posts/audience";
import { createPost, type SaveResult } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `aud-s-${run}`;
const classmate = `aud-c-${run}`;
const visitor = `aud-v-${run}`;
const people = [seller, classmate, visitor];

let counter = 0;
async function newPost(fields: Partial<NewPostInput> = {}, ownerId = seller): Promise<SaveResult> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  return createPost({
    ownerId,
    input: {
      kind: "showcase",
      title: `Audience post ${run} #${counter}`,
      description: "A post for the audience rules.",
      categoryId: "other",
      condition: null,
      priceKind: "free",
      priceAmount: "",
      exchangeMeetup: true,
      exchangeDelivery: false,
      meetupLocation: "Gate",
      availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      photos: photosOf([img.id]),
      ...fields,
    },
  });
}

async function postId(fields: Partial<NewPostInput> = {}, ownerId = seller): Promise<string> {
  const result = await newPost(fields, ownerId);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

beforeAll(async () => {
  await createTestStudent(seller, { handle: `aud_s_${run}`, name: "Sam Seller" });
  await createTestStudent(classmate, { handle: `aud_c_${run}`, name: "Cam Classmate" });
  await createTestStudent(visitor, { handle: `aud_v_${run}`, name: "Val Visitor", visitor: true });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterAll(async () => {
  const owned = await db.select({ id: post.id }).from(post).where(inArray(post.ownerId, people));
  if (owned.length > 0) {
    await db.delete(offer).where(inArray(offer.postId, owned.map((row) => row.id)));
  }
  await db.delete(conversation).where(inArray(conversation.participantA, people));
  await db.delete(conversation).where(inArray(conversation.participantB, people));
  await db.delete(post).where(inArray(post.ownerId, people));
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("audienceRefusal", () => {
  it("lets a student answer anything", () => {
    expect(audienceRefusal({ role: "student", kind: "showcase", allowNonStudents: false })).toBeNull();
    expect(audienceRefusal({ role: "student", kind: "wishlist", allowNonStudents: false })).toBeNull();
  });

  it("lets other roles answer only a showcase that allows them", () => {
    for (const role of ["faculty", "staff", "alumni", "visitor"] as const) {
      expect(audienceRefusal({ role, kind: "showcase", allowNonStudents: false })).toBe(STUDENTS_ONLY);
      expect(audienceRefusal({ role, kind: "showcase", allowNonStudents: true })).toBeNull();
    }
  });

  it("never lets a non-student answer a wishlist, even if the flag is set", () => {
    expect(audienceRefusal({ role: "visitor", kind: "wishlist", allowNonStudents: true })).toBe(STUDENTS_ONLY);
  });
});

describe("who can post", () => {
  it("refuses a showcase from a visitor but accepts a wishlist", async () => {
    const showcase = await newPost({ kind: "showcase" }, visitor);
    expect(showcase).toEqual({ ok: false, errors: { kind: SHOWCASE_STUDENTS_ONLY } });
    const wishlist = await newPost({ kind: "wishlist" }, visitor);
    expect(wishlist.ok).toBe(true);
  });

  it("stores the allow flag, off unless asked", async () => {
    const closed = await postId();
    const open = await postId({ allowNonStudents: true });
    const rows = await db.select({ id: post.id, flag: post.allowNonStudents }).from(post).where(inArray(post.id, [closed, open]));
    expect(rows.find((row) => row.id === closed)?.flag).toBe(false);
    expect(rows.find((row) => row.id === open)?.flag).toBe(true);
  });
});

describe("a visitor contacting a seller", () => {
  const hello = { body: "Is this still available?", imageIds: [] };

  it("cannot message or offer on a showcase that is students only", async () => {
    const id = await postId();
    expect(await startConversation({ senderId: visitor, postId: id, input: hello })).toEqual({ ok: false, error: STUDENTS_ONLY });
    expect(await makeOffer({ responderId: visitor, postId: id, input: { kind: "reserve", quantity: "1", note: "" } })).toEqual({ ok: false, error: STUDENTS_ONLY });
    expect(await db.select().from(offer).where(eq(offer.postId, id))).toHaveLength(0);
  });

  it("can message and reserve a showcase that allows non-students", async () => {
    const id = await postId({ allowNonStudents: true });
    expect((await startConversation({ senderId: visitor, postId: id, input: hello })).ok).toBe(true);
    expect((await makeOffer({ responderId: visitor, postId: id, input: { kind: "reserve", quantity: "1", note: "" } })).ok).toBe(true);
  });

  it("cannot answer a student's wishlist", async () => {
    const id = await postId({ kind: "wishlist", allowNonStudents: true });
    expect(await startConversation({ senderId: visitor, postId: id, input: hello })).toEqual({ ok: false, error: STUDENTS_ONLY });
  });

  it("does not change what a student may do", async () => {
    const id = await postId();
    expect((await startConversation({ senderId: classmate, postId: id, input: hello })).ok).toBe(true);
  });
});
