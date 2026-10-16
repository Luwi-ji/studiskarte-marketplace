import { randomBytes, randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { image, notification, post, pushSubscription, rateLimitEvent, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { expirePosts } from "@/lib/jobs/expire-posts";
import { warnExpiringPosts } from "@/lib/jobs/expiry-warnings";
import { sendMessage, startConversation } from "@/lib/messaging/send";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/list";
import { deliverAlert, type PushSender } from "@/lib/notifications/push/notify";
import { buildPayload } from "@/lib/notifications/push/payload";
import { removeSubscription, saveSubscription, SUBSCRIPTIONS_MAX } from "@/lib/notifications/push/subscriptions";
import { expiryKey } from "@/lib/notifications/record";
import { headline, notificationHref } from "@/lib/notifications/text";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { heartPost, unheartPost } from "@/lib/social/heart";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `nt-s-${run}`;
const ana = `nt-a-${run}`;
const ben = `nt-b-${run}`;
const people = [seller, ana, ben];
let counter = 0;

async function newPost(): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `Notify post ${run} #${counter}`,
    description: "A post that causes notifications.",
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

const say = (body: string) => ({ body, imageIds: [] as string[] });
const mine = (id: string) => db.select().from(notification).where(eq(notification.recipientId, id));
const fakeKey = () => randomBytes(65).toString("base64url");
const subscription = (endpoint = `https://push.example.com/send/${randomUUID()}`) => ({ endpoint, keys: { p256dh: fakeKey(), auth: randomBytes(16).toString("base64url") } });

beforeAll(async () => {
  await createTestStudent(seller, { handle: `sell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `ana_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `ben_${run}`, name: "Ben Buyer" });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  await db.delete(pushSubscription).where(inArray(pushSubscription.studentId, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("messages", () => {
  it("tells the other person, folds a busy chat into one entry, and never tells the sender", async () => {
    const postId = await newPost();
    const alerts: string[] = [];
    const alert = (id: string) => void alerts.push(id);
    const first = await startConversation({ senderId: ana, postId, input: say("one"), alert });
    if (!first.ok) throw new Error(first.error);
    await sendMessage({ senderId: ana, conversationId: first.conversationId, input: say("two"), alert });
    await sendMessage({ senderId: ana, conversationId: first.conversationId, input: say("three"), alert });

    const forSeller = await mine(seller);
    expect(forSeller).toHaveLength(1);
    expect(forSeller[0]).toMatchObject({ type: "message", count: 3, conversationId: first.conversationId, postId });
    expect(alerts).toHaveLength(3); // every new message asks for an alert (they replace each other on the device)
    expect(await mine(ana)).toHaveLength(0);

    // The owner's reply tells Ana, not the owner.
    await sendMessage({ senderId: seller, conversationId: first.conversationId, input: say("reply"), alert });
    expect(await mine(ana)).toHaveLength(1);
    expect(await mine(seller)).toHaveLength(1);
  });

  it("starts a new entry once the old one is read", async () => {
    const postId = await newPost();
    const first = await startConversation({ senderId: ana, postId, input: say("one") });
    if (!first.ok) throw new Error(first.error);
    const [entry] = await mine(seller);
    expect(await markNotificationRead(seller, entry.id)).toBe(true);
    await sendMessage({ senderId: ana, conversationId: first.conversationId, input: say("two") });
    const rows = await mine(seller);
    expect(rows).toHaveLength(2);
    expect(rows.filter((r) => r.readAt === null)).toHaveLength(1);
  });

  it("writes nothing for a recipient who is suspended, and nothing when the message is refused", async () => {
    const postId = await newPost();
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, seller));
    try {
      expect((await startConversation({ senderId: ana, postId, input: say("hi") })).ok).toBe(false);
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, seller));
    }
    expect(await mine(seller)).toHaveLength(0);
  });
});

describe("hearts", () => {
  it("tells the owner about the first heart with an alert, folds later ones silently, and never says who", async () => {
    const postId = await newPost();
    const alerts: string[] = [];
    const alert = (id: string) => void alerts.push(id);
    expect(await heartPost(ana, postId, alert)).toBe("ok");
    expect(await heartPost(ben, postId, alert)).toBe("ok");
    expect(await heartPost(ana, postId, alert)).toBe("ok"); // already hearted: tells nobody

    const rows = await mine(seller);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "heart", count: 2, postId });
    expect(alerts).toHaveLength(1);
    const text = JSON.stringify([await listNotifications(seller), buildPayload({ type: "heart", count: 2, postTitle: "Title", postId, conversationId: null })]);
    for (const secret of [ana, ben, `ana_${run}`, `ben_${run}`, "Ana", "Ben"]) expect(text).not.toContain(secret);
    expect(await mine(ana)).toHaveLength(0);
  });

  it("does not tell anyone about an un-heart, and refuses hearting your own post", async () => {
    const postId = await newPost();
    await heartPost(ana, postId);
    await unheartPost(ana, postId);
    expect((await mine(seller))[0].count).toBe(1);
    expect(await heartPost(seller, postId)).toBe("own_post");
    expect((await mine(seller))[0].count).toBe(1);
  });
});

describe("expiry notices", () => {
  it("warns the owner once when a post is within 3 days of expiring, not before, and warns again after a relist", async () => {
    const soon = await newPost();
    const later = await newPost();
    await db.update(post).set({ expiresAt: sql`now() + interval '2 days'` }).where(eq(post.id, soon));
    await db.update(post).set({ expiresAt: sql`now() + interval '10 days'` }).where(eq(post.id, later));

    const alerts: string[] = [];
    expect(await warnExpiringPosts(new Date(), (id) => void alerts.push(id))).toBe(1);
    expect(await warnExpiringPosts(new Date(), (id) => void alerts.push(id))).toBe(0);
    const rows = await mine(seller);
    expect(rows.map((r) => [r.type, r.postId])).toEqual([["post_expiring", soon]]);
    expect(alerts).toHaveLength(1);

    // A relist starts a new listing: it can warn again.
    await db.update(post).set({ listedAt: sql`now() + interval '1 second'`, expiresAt: sql`now() + interval '2 days'` }).where(eq(post.id, soon));
    expect(await warnExpiringPosts()).toBe(1);
    expect(await mine(seller)).toHaveLength(2);
  });

  it("tells the owner once when the job expires a post, and a second run adds nothing", async () => {
    const id = await newPost();
    await db.update(post).set({ expiresAt: sql`now() - interval '1 minute'`, listedAt: sql`now() - interval '31 days'` }).where(eq(post.id, id));
    const alerts: string[] = [];
    expect(await expirePosts(new Date(), (n) => void alerts.push(n))).toBeGreaterThanOrEqual(1);
    expect(await expirePosts()).toBe(0);
    const rows = (await mine(seller)).filter((r) => r.postId === id);
    expect(rows.map((r) => r.type)).toEqual(["post_expired"]);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
  });

  it("keys a notice to its listing", () => {
    const at = new Date("2026-10-16T00:00:00Z");
    expect(expiryKey("expiring", "p", at)).not.toBe(expiryKey("expiring", "p", new Date(at.getTime() + 1)));
    expect(expiryKey("expiring", "p", at)).not.toBe(expiryKey("expired", "p", at));
  });
});

describe("the list", () => {
  it("shows only your own, counts unread, and marks read without touching anyone else's", async () => {
    const postId = await newPost();
    await heartPost(ana, postId);
    await startConversation({ senderId: ben, postId, input: say("hello") });
    const sellerList = await listNotifications(seller);
    expect(sellerList.map((n) => n.type).sort()).toEqual(["heart", "message"]);
    expect(await countUnreadNotifications(seller)).toBe(2);
    expect(await countUnreadNotifications(ana)).toBe(0);

    const [first] = sellerList;
    expect(await markNotificationRead(ana, first.id)).toBe(false); // not theirs
    expect(await countUnreadNotifications(seller)).toBe(2);
    expect(await markNotificationRead(seller, first.id)).toBe(true);
    expect(await markNotificationRead(seller, first.id)).toBe(false);
    expect(await markAllNotificationsRead(seller)).toBe(1);
    expect(await countUnreadNotifications(seller)).toBe(0);
    expect((await listNotifications(seller)).every((n) => n.read)).toBe(true);
  });

  it("says what happened with the post's title and sends a tap to the right place", async () => {
    const postId = await newPost();
    const first = await startConversation({ senderId: ana, postId, input: say("hello") });
    if (!first.ok) throw new Error(first.error);
    const [item] = await listNotifications(seller);
    expect(item.postTitle).toContain(`Notify post ${run}`);
    expect(item.href).toBe(`/messages/${first.conversationId}`);
    expect(notificationHref({ type: "heart", postId, conversationId: null })).toBe(`/posts/${postId}`);
    expect(headline("message", 1)).toBe("New message");
    expect(headline("message", 3)).toBe("3 new messages");
    expect(headline("heart", 2)).toBe("2 hearts on your post");
  });
});

describe("devices", () => {
  it("saves a device, and saving it again is the same device", async () => {
    const sub = subscription();
    expect(await saveSubscription(ana, sub)).toBe("ok");
    expect(await saveSubscription(ana, sub)).toBe("ok");
    expect(await db.select().from(pushSubscription).where(eq(pushSubscription.studentId, ana))).toHaveLength(1);
  });

  it("refuses an address that is not https, bad keys, and anything that is not a subscription", async () => {
    expect(await saveSubscription(ana, { ...subscription(), endpoint: "http://push.example.com/x" })).toBe("invalid");
    expect(await saveSubscription(ana, { ...subscription(), keys: { p256dh: "short", auth: "x" } })).toBe("invalid");
    expect(await saveSubscription(ana, {})).toBe("invalid");
    expect(await saveSubscription(ana, "https://push.example.com/x")).toBe("invalid");
    expect(await db.select().from(pushSubscription).where(eq(pushSubscription.studentId, ana))).toHaveLength(0);
  });

  it("allows 10 devices and refuses the 11th, but lets an existing one be saved again", async () => {
    const subs = Array.from({ length: SUBSCRIPTIONS_MAX }, () => subscription());
    for (const s of subs) expect(await saveSubscription(ana, s)).toBe("ok");
    expect(await saveSubscription(ana, subscription())).toBe("limit");
    expect(await saveSubscription(ana, subs[0])).toBe("ok");
  });

  it("hands a shared phone to whoever turns alerts on next, and refuses a suspended student", async () => {
    const sub = subscription();
    await saveSubscription(ana, sub);
    expect(await saveSubscription(ben, sub)).toBe("ok");
    expect((await db.select().from(pushSubscription).where(eq(pushSubscription.endpoint, sub.endpoint)))[0].studentId).toBe(ben);

    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ana));
    try {
      expect(await saveSubscription(ana, subscription())).toBe("not_allowed");
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, ana));
    }
  });

  it("removes only the student's own device", async () => {
    const sub = subscription();
    await saveSubscription(ana, sub);
    await removeSubscription(ben, sub.endpoint);
    expect(await db.select().from(pushSubscription).where(eq(pushSubscription.endpoint, sub.endpoint))).toHaveLength(1);
    await removeSubscription(ana, sub.endpoint);
    expect(await db.select().from(pushSubscription).where(eq(pushSubscription.endpoint, sub.endpoint))).toHaveLength(0);
  });
});

describe("alerts", () => {
  /** A sender that records what it was given. */
  function recorder(failWith?: (endpoint: string) => unknown) {
    const calls: { endpoint: string; payload: string }[] = [];
    const send: PushSender = async (target, payload) => {
      calls.push({ endpoint: target.endpoint, payload });
      const error = failWith?.(target.endpoint);
      if (error) throw error;
    };
    return { calls, send };
  }

  /** A message from Ana to the seller about a fresh post; returns the notification it made. */
  async function aMessageFor(text: string) {
    const postId = await newPost();
    const notified: string[] = [];
    const result = await startConversation({ senderId: ana, postId, input: say(text), alert: (id) => void notified.push(id) });
    if (!result.ok) throw new Error(result.error);
    return { postId, id: notified[0] };
  }

  it("shows the post title and what happened, and never the message text", async () => {
    const secret = `private words ${randomUUID()}`;
    const sub = subscription();
    await saveSubscription(seller, sub);
    const { id } = await aMessageFor(secret);
    const { calls, send } = recorder();
    expect(await deliverAlert(id, send)).toEqual({ sent: 1, removed: 0 });
    const payload = JSON.parse(calls[0].payload);
    expect(payload).toMatchObject({ title: "New message", body: expect.stringContaining("Notify post") });
    expect(calls[0].payload).not.toContain(secret);
    expect(Object.keys(payload).sort()).toEqual(["body", "tag", "title", "url"]);
  });

  it("goes only to the recipient's devices, never the sender's", async () => {
    const sellerDevice = subscription();
    const anaDevice = subscription();
    await saveSubscription(seller, sellerDevice);
    await saveSubscription(ana, anaDevice);
    const { id } = await aMessageFor("hello");
    const { calls, send } = recorder();
    await deliverAlert(id, send);
    expect(calls.map((c) => c.endpoint)).toEqual([sellerDevice.endpoint]);
  });

  it("removes a device the push service says is gone, and keeps one that merely failed", async () => {
    const gone = subscription();
    const flaky = subscription();
    const fine = subscription();
    for (const s of [gone, flaky, fine]) await saveSubscription(seller, s);
    const { id } = await aMessageFor("hello");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { send } = recorder((endpoint) => (endpoint === gone.endpoint ? { statusCode: 410 } : endpoint === flaky.endpoint ? { statusCode: 500 } : null));
    expect(await deliverAlert(id, send)).toEqual({ sent: 1, removed: 1 });
    log.mockRestore();
    const left = (await db.select({ e: pushSubscription.endpoint }).from(pushSubscription).where(eq(pushSubscription.studentId, seller))).map((r) => r.e).sort();
    expect(left).toEqual([flaky.endpoint, fine.endpoint].sort());
  });

  it("sends nothing to a suspended student or to someone with no device, and never throws", async () => {
    const { id } = await aMessageFor("hello");
    const { calls, send } = recorder();
    expect(await deliverAlert(id, send)).toEqual({ sent: 0, removed: 0 }); // no device yet
    await saveSubscription(seller, subscription());
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, seller));
    try {
      expect(await deliverAlert(id, send)).toEqual({ sent: 0, removed: 0 });
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, seller));
    }
    expect(calls).toHaveLength(0);
    expect(await deliverAlert(randomUUID(), send)).toEqual({ sent: 0, removed: 0 });
  });

  it("builds an alert from the type alone: a title line, the post title, and where to go", () => {
    const payload = buildPayload({ type: "post_expiring", count: 1, postTitle: "Desk lamp", postId: "p1", conversationId: null });
    expect(payload).toEqual({ title: "Your post expires soon", body: "Desk lamp", url: "/posts/p1", tag: "post_expiring:/posts/p1" });
  });
});
