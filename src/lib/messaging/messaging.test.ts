import { randomUUID } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { conversation, conversationListing, image, message, messageImage, post, rateLimitEvent } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";
import { cleanupUnusedPhotos } from "@/lib/jobs/cleanup";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { countUnread, getConversation, listConversations, markRead } from "@/lib/messaging/read";
import { CLOSED_ACCOUNT, CLOSED_POST, listingClosedReason, MESSAGE_MAX, MESSAGES_PER_MINUTE, orderedPair, parseMessage, readOnlyReason } from "@/lib/messaging/rules";
import { sendMessage, startConversation } from "@/lib/messaging/send";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `msg-s-${run}`;
const ana = `msg-a-${run}`;
const ben = `msg-b-${run}`;
const stranger = `msg-x-${run}`;
const people = [seller, ana, ben, stranger];

let counter = 0;
async function newPost(): Promise<string> {
  counter += 1;
  const title = `Message post ${run} #${counter}`;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title,
    description: "A post to message about.",
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
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

async function messagePhoto(ownerId: string, purpose = "message_photo", createdAt = new Date()): Promise<string> {
  const name = randomUUID();
  const [row] = await db
    .insert(image)
    .values({ ownerId, purpose, key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1, createdAt })
    .returning({ id: image.id });
  return row.id;
}

const say = (body: string, imageIds: string[] = []) => ({ body, imageIds });

/** A conversation between `from` and the seller about a fresh post. */
async function started(from = ana): Promise<{ postId: string; conversationId: string }> {
  const postId = await newPost();
  const result = await startConversation({ senderId: from, postId, input: say("Is this still available?") });
  if (!result.ok) throw new Error(result.error);
  return { postId, conversationId: result.conversationId };
}

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Buyer" });
  await createTestStudent(stranger, { handle: `str_${run}`, name: "Stan Stranger" });
}, 60_000);

// Every test sends as the same few students; the per-minute limit has its own test.
beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

/** The conversations the seller is in. Everyone talks to the seller, so each test starts with none. */
async function clearThreads() {
  await db.delete(conversation).where(or(eq(conversation.participantA, seller), eq(conversation.participantB, seller)));
}

/** The conversations between two people (there is never more than one). */
async function between(x: string, y: string) {
  const { a, b } = orderedPair(x, y);
  return db.select().from(conversation).where(and(eq(conversation.participantA, a), eq(conversation.participantB, b)));
}

// A seller may have only 20 open posts, and each test makes its own.
afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await clearThreads();
});

afterAll(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await clearThreads();
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("what a message may contain", () => {
  it("takes text, photos, or both, trimmed, and refuses neither", () => {
    expect(parseMessage(say("  hello  "))).toEqual({ ok: true, data: { body: "hello", imageIds: [] } });
    const id = randomUUID();
    expect(parseMessage(say("   ", [id]))).toEqual({ ok: true, data: { body: null, imageIds: [id] } });
    expect(parseMessage(say("   ")).ok).toBe(false);
    expect(parseMessage({}).ok).toBe(false);
    expect(parseMessage("hello").ok).toBe(false);
  });

  it("limits text to 2000 characters and photos to 4, each once", () => {
    expect(parseMessage(say("x".repeat(MESSAGE_MAX))).ok).toBe(true);
    expect(parseMessage(say("x".repeat(MESSAGE_MAX + 1)))).toMatchObject({ ok: false });
    const ids = Array.from({ length: 5 }, () => randomUUID());
    expect(parseMessage(say("", ids.slice(0, 4))).ok).toBe(true);
    expect(parseMessage(say("", ids)).ok).toBe(false);
    expect(parseMessage(say("", [ids[0], ids[0]])).ok).toBe(false);
    expect(parseMessage(say("", ["not-a-uuid"])).ok).toBe(false);
  });
});

describe("when a conversation takes messages", () => {
  it("is closed only when either person is suspended or deleted", () => {
    expect(readOnlyReason({ aStatus: "active", bStatus: "active" })).toBeNull();
    expect(readOnlyReason({ aStatus: "suspended", bStatus: "active" })).toBe(CLOSED_ACCOUNT);
    expect(readOnlyReason({ aStatus: "active", bStatus: "deleted" })).toBe(CLOSED_ACCOUNT);
  });
});

describe("when something new can be started about a listing", () => {
  const future = new Date(Date.now() + 86_400_000);
  const base = { postStatus: "open", postExpiresAt: future, ownerStatus: "active", responderStatus: "active" };
  it("is possible for an open or reserved listing, and not otherwise", () => {
    expect(listingClosedReason(base)).toBeNull();
    expect(listingClosedReason({ ...base, postStatus: "reserved" })).toBeNull();
    for (const status of ["withdrawn", "expired", "fulfilled", "hidden", "removed"]) {
      expect(listingClosedReason({ ...base, postStatus: status })).toBe(CLOSED_POST);
    }
    expect(listingClosedReason({ ...base, postExpiresAt: new Date(Date.now() - 1000) })).toBe(CLOSED_POST);
  });
  it("is closed when either person is suspended or deleted", () => {
    expect(listingClosedReason({ ...base, ownerStatus: "suspended" })).toBe(CLOSED_ACCOUNT);
    expect(listingClosedReason({ ...base, responderStatus: "deleted" })).toBe(CLOSED_ACCOUNT);
  });
});

describe("starting a conversation", () => {
  it("creates the conversation with the first message, and later messages about the post join it", async () => {
    const { postId, conversationId } = await started();
    const again = await startConversation({ senderId: ana, postId, input: say("Second") });
    expect(again).toEqual({ ok: true, conversationId });
    const view = await getConversation(ana, conversationId);
    expect(view?.messages.map((m) => [m.body, m.mine])).toEqual([["Is this still available?", true], ["Second", true]]);
    expect(view?.messages.every((m) => m.listing?.post.id === postId)).toBe(true);
    expect(view?.listings.map((l) => l.post.id)).toEqual([postId]);
    expect(await between(ana, seller)).toHaveLength(1);
  });

  it("refuses messaging your own post, and a conversation with yourself or in the wrong order, in the database", async () => {
    const postId = await newPost();
    expect(await startConversation({ senderId: seller, postId, input: say("Hi me") })).toEqual({ ok: false, error: "You can't message your own post." });
    await expect(db.insert(conversation).values({ participantA: seller, participantB: seller })).rejects.toMatchObject({ cause: { code: "23514" } });
    const { a, b } = orderedPair(ana, seller);
    await expect(db.insert(conversation).values({ participantA: b, participantB: a })).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("gives two students who message the same post at the same moment a conversation each", async () => {
    const postId = await newPost();
    const [a, b] = await Promise.all([
      startConversation({ senderId: ana, postId, input: say("From Ana") }),
      startConversation({ senderId: ben, postId, input: say("From Ben") }),
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.conversationId).not.toBe(b.conversationId);
    expect((await getConversation(ana, a.conversationId))?.messages.map((m) => m.body)).toEqual(["From Ana"]);
    expect((await getConversation(ben, b.conversationId))?.messages.map((m) => m.body)).toEqual(["From Ben"]);
  });

  it("keeps one conversation when the same student's first messages arrive together", async () => {
    const postId = await newPost();
    const results = await Promise.all([1, 2, 3].map((n) => startConversation({ senderId: ana, postId, input: say(`Twice ${n}`) })));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await between(ana, seller)).toHaveLength(1);
    expect(await db.select().from(message).innerJoin(conversation, eq(conversation.id, message.conversationId)).where(eq(message.postId, postId))).toHaveLength(3);
  });

  it("is refused for a post that is withdrawn, expired, or unknown", async () => {
    const withdrawn = await newPost();
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, withdrawn));
    expect(await startConversation({ senderId: ana, postId: withdrawn, input: say("Hi") })).toEqual({ ok: false, error: CLOSED_POST });

    const lapsed = await newPost();
    await db.update(post).set({ expiresAt: sql`now() - interval '1 minute'`, listedAt: sql`now() - interval '31 days'` }).where(eq(post.id, lapsed));
    expect(await startConversation({ senderId: ana, postId: lapsed, input: say("Hi") })).toEqual({ ok: false, error: CLOSED_POST });

    expect(await startConversation({ senderId: ana, postId: randomUUID(), input: say("Hi") })).toMatchObject({ ok: false });
    expect(await between(ana, seller)).toHaveLength(0);
    expect(await db.select().from(conversationListing).where(inArray(conversationListing.postId, [withdrawn, lapsed]))).toHaveLength(0);
  });

  it("leaves nothing behind when the message is refused", async () => {
    const postId = await newPost();
    const result = await startConversation({ senderId: ana, postId, input: say("Hi", [randomUUID()]) });
    expect(result).toMatchObject({ ok: false });
    expect(await between(ana, seller)).toHaveLength(0);
    expect(await db.select().from(conversationListing).where(eq(conversationListing.postId, postId))).toHaveLength(0);
  });
});

describe("one conversation for a pair, however many listings", () => {
  it("puts messages about two listings in the same thread, each with its own listing card", async () => {
    const first = await started();
    const second = await started();
    expect(second.conversationId).toBe(first.conversationId);
    expect(await sendMessage({ senderId: seller, conversationId: first.conversationId, input: say("Yes, both are free.") })).toMatchObject({ ok: true });

    const view = await getConversation(ana, first.conversationId);
    expect(view?.messages.map((m) => m.listing?.post.id ?? null)).toEqual([first.postId, second.postId, null]);
    // The listing with the newest message comes first.
    expect(view?.listings.map((l) => l.post.id)).toEqual([second.postId, first.postId]);
    expect(view?.listings.every((l) => !l.viewerIsOwner)).toBe(true);
    expect((await getConversation(seller, first.conversationId))?.listings.every((l) => l.viewerIsOwner)).toBe(true);
    expect(await between(ana, seller)).toHaveLength(1);
  });

  it("shows the inbox the listing's title when there is one, and the number of listings when there are more", async () => {
    const first = await started();
    const [row] = await db.select({ title: post.title }).from(post).where(eq(post.id, first.postId));
    expect((await listConversations(ana)).find((c) => c.id === first.conversationId)).toMatchObject({ listingCount: 1, listingTitle: row.title });
    await started();
    expect((await listConversations(ana)).find((c) => c.id === first.conversationId)).toMatchObject({ listingCount: 2, listingTitle: null });
    expect((await listConversations(seller)).find((c) => c.id === first.conversationId)).toMatchObject({ listingCount: 2 });
  });

  it("refuses in the database a listing card or a listing for a post that belongs to neither person", async () => {
    const { conversationId } = await started();
    const [elsewhere] = await db.insert(image).values({ ownerId: ben, purpose: "post_photo", key: `t/${randomUUID()}`, thumbKey: `t/${randomUUID()}`, width: 1, height: 1, bytes: 1 }).returning({ id: image.id });
    const created = await createPost({
      ownerId: ben,
      input: {
        kind: "showcase", title: `Ben's post ${run}`, description: "Not theirs.", categoryId: "other", condition: null, priceKind: "free", priceAmount: "",
        exchangeMeetup: true, exchangeDelivery: false, meetupLocation: "Gate", deliveryArea: "",
        availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }], photos: photosOf([elsewhere.id]),
      },
    });
    if (!created.ok) throw new Error(JSON.stringify(created.errors));
    try {
      await expect(db.insert(conversationListing).values({ conversationId, postId: created.id })).rejects.toMatchObject({ cause: { code: "23514" } });
      await expect(db.insert(message).values({ conversationId, senderId: ana, body: "see this", postId: created.id })).rejects.toMatchObject({ cause: { code: "23514" } });
    } finally {
      await db.delete(post).where(eq(post.id, created.id));
    }
  });

  it("keeps each side's read position when the pair is stored the other way round", async () => {
    // Ana and Ben both talk to the seller: one of the two pairs is stored seller-first and the other buyer-first.
    const a = await started(ana);
    const b = await started(ben);
    await sendMessage({ senderId: seller, conversationId: a.conversationId, input: say("To Ana") });
    await sendMessage({ senderId: seller, conversationId: b.conversationId, input: say("To Ben") });
    expect((await getConversation(ana, a.conversationId))?.unread).toBe(1);
    expect((await getConversation(ben, b.conversationId))?.unread).toBe(1);
    expect(await markRead(ana, a.conversationId)).toBe(true);
    expect(await markRead(ben, b.conversationId)).toBe(true);
    expect((await getConversation(ana, a.conversationId))?.unread).toBe(0);
    expect((await getConversation(ben, b.conversationId))?.unread).toBe(0);
    // Replying read the seller's side. A new message from Ben counts for the seller in Ben's thread only.
    await sendMessage({ senderId: ben, conversationId: b.conversationId, input: say("Ben again") });
    const unread = new Map((await listConversations(seller)).map((c) => [c.id, c.unread]));
    expect(unread.get(a.conversationId)).toBe(0);
    expect(unread.get(b.conversationId)).toBe(1);
  });
});

describe("who can read and write", () => {
  it("shows a conversation only to its two participants", async () => {
    const { conversationId } = await started();
    expect(await getConversation(ana, conversationId)).not.toBeNull();
    expect(await getConversation(seller, conversationId)).not.toBeNull();
    expect(await getConversation(stranger, conversationId)).toBeNull();
    expect(await getConversation(ben, conversationId)).toBeNull();
    expect((await listConversations(stranger)).map((c) => c.id)).not.toContain(conversationId);
  });

  it("lets a stranger neither write nor mark read, with the same answer as for a missing conversation", async () => {
    const { conversationId } = await started();
    const refused = await sendMessage({ senderId: stranger, conversationId, input: say("Let me in") });
    const missing = await sendMessage({ senderId: stranger, conversationId: randomUUID(), input: say("Hello?") });
    expect(refused).toEqual(missing);
    expect(refused).toMatchObject({ ok: false });
    expect(await markRead(stranger, conversationId)).toBe(false);
    expect((await getConversation(ana, conversationId))?.messages).toHaveLength(1);
  });

  it("refuses in the database a message from someone outside the conversation", async () => {
    const { conversationId } = await started();
    await expect(db.insert(message).values({ conversationId, senderId: stranger, body: "Sneaky" })).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("refuses in the database a message with no text and no picture", async () => {
    const { conversationId } = await started();
    await expect(db.insert(message).values({ conversationId, senderId: ana, body: null })).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("lets the owner reply, and both see the same thread", async () => {
    const { conversationId } = await started();
    expect(await sendMessage({ senderId: seller, conversationId, input: say("Yes, it is.") })).toEqual({ ok: true, conversationId });
    const asSeller = await getConversation(seller, conversationId);
    const asAna = await getConversation(ana, conversationId);
    expect(asSeller?.messages.map((m) => [m.body, m.mine])).toEqual([["Is this still available?", false], ["Yes, it is.", true]]);
    expect(asAna?.messages.map((m) => [m.body, m.mine])).toEqual([["Is this still available?", true], ["Yes, it is.", false]]);
    expect(asAna?.other).toMatchObject({ handle: `sell_${run}`, displayName: "Sam Seller" });
    expect(asSeller?.other).toMatchObject({ handle: `ana_${run}` });
  });
});

describe("pictures", () => {
  it("sends the sender's own message photos, in order, and shows them only to the two people", async () => {
    const { conversationId } = await started();
    const [one, two] = [await messagePhoto(ana), await messagePhoto(ana)];
    expect((await sendMessage({ senderId: ana, conversationId, input: say("", [two, one]) })).ok).toBe(true);
    const view = await getConversation(seller, conversationId);
    const last = view?.messages.at(-1);
    expect(last?.body).toBeNull();
    expect(last?.pictures).toHaveLength(2);
    const [rows] = await Promise.all([db.select({ id: messageImage.imageId, pos: messageImage.position }).from(messageImage).orderBy(messageImage.position).where(eq(messageImage.messageId, last!.id))]);
    expect(rows.map((r) => r.id)).toEqual([two, one]);
    expect(JSON.stringify(await getConversation(stranger, conversationId))).toBe("null");
  });

  it("refuses someone else's photo, a post photo, a photo already sent, and one that does not exist", async () => {
    const { conversationId } = await started();
    const theirs = await messagePhoto(seller);
    const postPhotoId = await messagePhoto(ana, "post_photo");
    const mine = await messagePhoto(ana);
    expect((await sendMessage({ senderId: ana, conversationId, input: say("", [theirs]) })).ok).toBe(false);
    expect((await sendMessage({ senderId: ana, conversationId, input: say("", [postPhotoId]) })).ok).toBe(false);
    expect((await sendMessage({ senderId: ana, conversationId, input: say("", [randomUUID()]) })).ok).toBe(false);
    expect((await sendMessage({ senderId: ana, conversationId, input: say("ok", [mine]) })).ok).toBe(true);
    expect((await sendMessage({ senderId: ana, conversationId, input: say("again", [mine]) })).ok).toBe(false);
    expect((await getConversation(ana, conversationId))?.messages).toHaveLength(2); // the first message and "ok"
  });

  it("refuses in the database a picture that is not the sender's own message photo", async () => {
    const { conversationId } = await started();
    const [sent] = await db.insert(message).values({ conversationId, senderId: ana, body: "pic" }).returning({ id: message.id });
    const theirs = await messagePhoto(seller);
    await expect(db.insert(messageImage).values({ messageId: sent.id, imageId: theirs, position: 0 })).rejects.toMatchObject({ cause: { code: "23514" } });
  });

  it("lets cleanup remove old photos that were never sent, and keep sent and recent ones", async () => {
    const { conversationId } = await started();
    const old = new Date(Date.now() - 2 * 86_400_000);
    const [unusedOld, sent, recent] = [await messagePhoto(ana, "message_photo", old), await messagePhoto(ana, "message_photo", old), await messagePhoto(ana)];
    await sendMessage({ senderId: ana, conversationId, input: say("", [sent]) });
    const deleted: string[] = [];
    const store: ObjectStore = { put: async () => {}, delete: async (keys) => void deleted.push(...keys), signedUrl: async () => "" };
    await cleanupUnusedPhotos(store);
    const left = (await db.select({ id: image.id }).from(image).where(inArray(image.id, [unusedOld, sent, recent]))).map((r) => r.id);
    expect(left.sort()).toEqual([sent, recent].sort());
  });
});

describe("closed posts and relisting", () => {
  it("keeps the conversation open when a listing closes, but nothing new can be started about that listing until it is relisted", async () => {
    const { postId, conversationId } = await started();
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, postId));
    expect(await sendMessage({ senderId: ana, conversationId, input: say("Still there?") })).toEqual({ ok: true, conversationId });
    expect(await sendMessage({ senderId: seller, conversationId, input: say("Sorry, it is gone") })).toEqual({ ok: true, conversationId });
    expect(await startConversation({ senderId: ana, postId, input: say("What about now?") })).toEqual({ ok: false, error: CLOSED_POST });
    const readable = await getConversation(ana, conversationId);
    expect(readable?.readOnlyReason).toBeNull();
    expect(readable?.messages).toHaveLength(3);
    expect(readable?.listings[0].post.status).toBe("withdrawn");

    // An expired post, then the owner relists it.
    await db.update(post).set({ status: "expired" }).where(eq(post.id, postId));
    expect(await startConversation({ senderId: ana, postId, input: say("Hello?") })).toEqual({ ok: false, error: CLOSED_POST });
    await db
      .update(post)
      .set({ status: "open", listedAt: sql`now()`, expiresAt: sql`now() + interval '30 days'` })
      .where(eq(post.id, postId));
    expect((await startConversation({ senderId: ana, postId, input: say("Back again") })).ok).toBe(true);
  });

  it("stays active for a reserved post and closes when someone is suspended", async () => {
    const { postId, conversationId } = await started(ben);
    await db.update(post).set({ status: "reserved" }).where(eq(post.id, postId));
    expect((await sendMessage({ senderId: ben, conversationId, input: say("Reserved ok") })).ok).toBe(true);
    expect((await startConversation({ senderId: ben, postId, input: say("Another question") })).ok).toBe(true);
    await db.update(post).set({ status: "open" }).where(eq(post.id, postId));
    await db.execute(sql`update student set account_status = 'suspended' where id = ${ben}`);
    try {
      expect(await sendMessage({ senderId: seller, conversationId, input: say("Hello?") })).toEqual({ ok: false, error: CLOSED_ACCOUNT });
      expect((await getConversation(seller, conversationId))?.readOnlyReason).toBe(CLOSED_ACCOUNT);
    } finally {
      await db.execute(sql`update student set account_status = 'active' where id = ${ben}`);
    }
  });
});

describe("unread", () => {
  it("counts the other person's messages until read, for each side on its own", async () => {
    const { conversationId } = await started();
    await sendMessage({ senderId: ana, conversationId, input: say("One more") });
    expect((await listConversations(seller)).find((c) => c.id === conversationId)?.unread).toBe(2);
    expect((await listConversations(ana)).find((c) => c.id === conversationId)?.unread).toBe(0);

    expect(await markRead(seller, conversationId)).toBe(true);
    expect(await markRead(seller, conversationId)).toBe(false);
    expect((await listConversations(seller)).find((c) => c.id === conversationId)?.unread).toBe(0);

    await sendMessage({ senderId: seller, conversationId, input: say("Reply") });
    expect((await listConversations(ana)).find((c) => c.id === conversationId)?.unread).toBe(1);
    expect((await listConversations(seller)).find((c) => c.id === conversationId)?.unread).toBe(0);
    expect((await getConversation(ana, conversationId))?.unread).toBe(1);
  });

  it("adds up across conversations for the badge", async () => {
    const before = await countUnread(seller);
    const a = await started(ana);
    const b = await started(ben);
    expect(await countUnread(seller)).toBe(before + 2);
    await markRead(seller, a.conversationId);
    expect(await countUnread(seller)).toBe(before + 1);
    await markRead(seller, b.conversationId);
    expect(await countUnread(seller)).toBe(before);
  });

  it("lists the most recently active conversation first, with its last message", async () => {
    const first = await started(ana);
    const second = await started(ben);
    await sendMessage({ senderId: ana, conversationId: first.conversationId, input: say("", [await messagePhoto(ana)]) });
    const list = await listConversations(seller);
    const ids = list.map((c) => c.id);
    expect(ids.indexOf(first.conversationId)).toBeLessThan(ids.indexOf(second.conversationId));
    expect(list[ids.indexOf(first.conversationId)].lastMessage).toMatchObject({ body: null, hasPictures: true, fromMe: false });
    expect(list[ids.indexOf(second.conversationId)].lastMessage).toMatchObject({ body: "Is this still available?", hasPictures: false });
  });
});

describe("rate limit", () => {
  it("allows 20 messages a minute from one student and refuses the next", async () => {
    const { conversationId } = await started(stranger);
    await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, stranger));
    const results = [];
    for (let i = 0; i < MESSAGES_PER_MINUTE + 1; i++) results.push(await sendMessage({ senderId: stranger, conversationId, input: say(`m${i}`) }));
    expect(results.slice(0, MESSAGES_PER_MINUTE).every((r) => r.ok)).toBe(true);
    expect(results.at(-1)).toMatchObject({ ok: false, error: expect.stringContaining("too fast") });
    await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, stranger));
  }, 120_000);
});
