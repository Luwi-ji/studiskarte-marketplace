import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { block, conversation, deal, follow, heart, image, notification, post, rateLimitEvent, school } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { answerCash, requestCash } from "@/lib/deals/payment";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { listFeed, listHeartedBy, listPostsBy } from "@/lib/discovery/feed";
import { parseFilters } from "@/lib/discovery/filters";
import { listSchoolsWithPosts, searchPeople, searchSchools } from "@/lib/discovery/search";
import { getPublicProfile } from "@/lib/identity/profile";
import { getConversation } from "@/lib/messaging/read";
import { CLOSED_ACCOUNT } from "@/lib/messaging/rules";
import { sendMessage, startConversation } from "@/lib/messaging/send";
import { createPost } from "@/lib/posts/create";
import { getPostDetail } from "@/lib/posts/detail";
import type { NewPostInput } from "@/lib/posts/schema";
import { recordView } from "@/lib/posts/views";
import { blockedEitherWaySql, blockStudent, isBlockedEitherWay, listBlocked, unblockStudent } from "@/lib/safety/block";
import { followStudent } from "@/lib/social/follow";
import { heartPost, listUnavailableHearts } from "@/lib/social/heart";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
// A school of its own, so listing counts are exactly these posts.
const domain = `bk${run}.edu.ph`;
const tag = `zb${run}`;
const ana = `bk-a-${run}`; // blocks
const ben = `bk-b-${run}`; // is blocked
const cy = `bk-c-${run}`; // a third party
const people = [ana, ben, cy];
const handleOf = (id: string) => `bk${id.slice(3, 4)}_${run}`;
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

async function newPost(ownerId: string, priced = false): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `Block post ${tag} #${counter}`,
    description: "A post for the block tests.",
    categoryId: "other",
    condition: null,
    priceKind: priced ? "amount" : "free",
    priceAmount: priced ? "500" : "",
    paymentCash: true,
    paymentOnline: false,
    paymentOther: false,
    paymentNote: "",
    quantity: "1",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Main gate",
    // Mondays 09:00 to 10:00, Philippine time.
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** A coming Monday at 09:30 in the Philippines: inside the post's availability. */
function mondaySlot(): { date: string; time: string } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + i * DAY + 8 * HOUR); // the Philippine wall clock, read as UTC
    if (wall.getUTCDay() === 1) return { date: wall.toISOString().slice(0, 10), time: "09:30" };
  }
  throw new Error("no Monday in two weeks");
}

/** A scheduled handover on a priced post of `ownerId`, reserved by `buyerId`. */
async function scheduled(ownerId: string, buyerId: string): Promise<{ postId: string; dealId: string; conversationId: string }> {
  const postId = await newPost(ownerId, true);
  const offer = await makeOffer({ responderId: buyerId, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  const proposed = await proposeHandover({ actorId: buyerId, dealId: row.id, input: { method: "meetup", ...mondaySlot(), place: "Library steps" } });
  if (!proposed.ok) throw new Error(proposed.error);
  const agreed = await answerProposal({ actorId: ownerId, dealId: row.id, agree: true });
  if (!agreed.ok) throw new Error(agreed.error);
  return { postId, dealId: row.id, conversationId: offer.conversationId };
}

const say = (body: string) => ({ body });
const feedIds = async (viewerId: string) => (await listFeed(viewerId, { filters: parseFilters({ q: tag, school: domain }), limit: 100 })).items.map((i) => i.id);
const noticesFor = async (id: string) => (await db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id))).map((n) => n.type).sort();
const dealRow = async (id: string) => (await db.select().from(deal).where(eq(deal.id, id)))[0];
const postStatus = async (id: string) => (await db.select({ s: post.status }).from(post).where(eq(post.id, id)))[0].s;

beforeAll(async () => {
  for (const id of people) await createTestStudent(id, { handle: handleOf(id), name: `Block ${id.slice(3, 4)} ${run}`, schoolDomain: domain });
  await db.update(school).set({ name: `Block Polytechnic ${run}` }).where(eq(school.domain, domain));
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(block).where(or(inArray(block.blockerId, people), inArray(block.blockedId, people)));
  await db.delete(follow).where(inArray(follow.followerId, people));
  await db.delete(heart).where(inArray(heart.studentId, people));
  await db.delete(post).where(inArray(post.ownerId, people));
  await db.delete(conversation).where(or(inArray(conversation.participantA, people), inArray(conversation.participantB, people)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await db.delete(school).where(eq(school.domain, domain));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("blocking a student", () => {
  it("is refused for yourself and for an unknown handle, and doing it twice is the same as once", async () => {
    expect(await blockStudent(ana, handleOf(ana))).toBe("self");
    expect(await blockStudent(ana, "nobody_here_0")).toBe("not_found");
    expect(await blockStudent(ana, `@${handleOf(ben).toUpperCase()}`)).toBe("ok");
    expect(await blockStudent(ana, handleOf(ben))).toBe("ok");
    expect(await db.select().from(block).where(eq(block.blockerId, ana))).toHaveLength(1);
    expect(await isBlockedEitherWay(ana, ben)).toBe(true);
    expect(await isBlockedEitherWay(ben, ana)).toBe(true);
    expect(await isBlockedEitherWay(ana, cy)).toBe(false);
    const [row] = await db.select({ blocked: blockedEitherWaySql(ben, ana) }).from(block).where(eq(block.blockerId, ana));
    expect(row.blocked).toBe(true);
  });

  it("lists who you blocked, only for the blocker, and unblocking removes it (safe when there was none)", async () => {
    await blockStudent(ana, handleOf(ben));
    expect((await listBlocked(ana)).map((s) => s.id)).toEqual([ben]);
    expect(await listBlocked(ben)).toEqual([]);
    await unblockStudent(ben, handleOf(ana)); // not the blocker: nothing changes
    expect(await isBlockedEitherWay(ana, ben)).toBe(true);
    await unblockStudent(ana, handleOf(ben));
    await unblockStudent(ana, handleOf(ben));
    await unblockStudent(ana, "nobody_here_0");
    expect(await listBlocked(ana)).toEqual([]);
    expect(await isBlockedEitherWay(ana, ben)).toBe(false);
  });

  it("hides posts both ways in the feed, on profiles, and in the hearted list, and leaves third parties alone", async () => {
    const anaPost = await newPost(ana);
    const benPost = await newPost(ben);
    const cyPost = await newPost(cy);
    expect(await heartPost(ben, anaPost)).toBe("ok");
    expect(await feedIds(ben)).toEqual(expect.arrayContaining([anaPost, benPost, cyPost]));

    await blockStudent(ana, handleOf(ben));

    const forAna = await feedIds(ana);
    expect(forAna).toEqual(expect.arrayContaining([anaPost, cyPost]));
    expect(forAna).not.toContain(benPost);
    const forBen = await feedIds(ben);
    expect(forBen).toEqual(expect.arrayContaining([benPost, cyPost]));
    expect(forBen).not.toContain(anaPost);
    expect(await feedIds(cy)).toEqual(expect.arrayContaining([anaPost, benPost, cyPost]));

    expect(await listPostsBy(ana, ben)).toEqual([]);
    expect(await listPostsBy(ben, ana)).toEqual([]);
    expect((await listPostsBy(cy, ana)).map((i) => i.id)).toEqual([anaPost]);

    // The heart stays, listed as no longer available, with nothing about the post.
    const available = (await listHeartedBy(ben)).map((i) => i.id);
    expect(available).not.toContain(anaPost);
    expect(await listUnavailableHearts(ben, available)).toContain(anaPost);

    await unblockStudent(ana, handleOf(ben));
    expect(await feedIds(ben)).toContain(anaPost);
    expect((await listHeartedBy(ben)).map((i) => i.id)).toContain(anaPost);
  });

  it("makes the post page, a view and a heart unavailable both ways, but the owner always sees their own", async () => {
    const anaPost = await newPost(ana);
    const benPost = await newPost(ben);
    await blockStudent(ana, handleOf(ben));

    expect(await getPostDetail(ben, anaPost)).toBeNull();
    expect(await getPostDetail(ana, benPost)).toBeNull();
    expect((await getPostDetail(ana, anaPost))?.isOwner).toBe(true);
    expect(await getPostDetail(cy, anaPost)).not.toBeNull();
    expect(await recordView(ben, anaPost)).toBe(false);
    expect(await recordView(ana, benPost)).toBe(false);
    expect(await recordView(cy, anaPost)).toBe(true);
    expect(await heartPost(ben, anaPost)).toBe("not_found");
    expect(await heartPost(ana, benPost)).toBe("not_found");
    expect(await heartPost(cy, anaPost)).toBe("ok");
  });

  it("hides the profile and the person in search both ways, and the listings from the school counts", async () => {
    await newPost(ana);
    await newPost(ben);
    await newPost(cy);
    const count = async (viewerId: string) => (await searchSchools(viewerId, `block polytechnic ${run}`))[0]?.listings;
    expect(await count(ana)).toBe(3);

    await blockStudent(ana, handleOf(ben));

    expect(await getPublicProfile(ana, handleOf(ben))).toBeNull();
    expect(await getPublicProfile(ben, handleOf(ana))).toBeNull();
    expect((await getPublicProfile(cy, handleOf(ana)))?.id).toBe(ana);
    expect((await getPublicProfile(ana, handleOf(ana)))?.isSelf).toBe(true);

    expect((await searchPeople(ana, handleOf(ben))).map((p) => p.handle)).not.toContain(handleOf(ben));
    expect((await searchPeople(ben, handleOf(ana))).map((p) => p.handle)).not.toContain(handleOf(ana));
    expect((await searchPeople(cy, handleOf(ana))).map((p) => p.handle)).toContain(handleOf(ana));

    expect(await count(ana)).toBe(2);
    expect(await count(ben)).toBe(2);
    expect(await count(cy)).toBe(3);
    expect((await listSchoolsWithPosts(ana)).map((s) => s.domain)).toContain(domain);
  });

  it("removes follows in both directions and refuses a new follow either way", async () => {
    expect(await followStudent(ana, ben)).toBe("ok");
    expect(await followStudent(ben, ana)).toBe("ok");
    expect(await followStudent(cy, ana)).toBe("ok");

    await blockStudent(ana, handleOf(ben));

    expect(await db.select().from(follow).where(or(inArray(follow.followerId, [ana, ben]), inArray(follow.followeeId, [ana, ben])))).toEqual([
      expect.objectContaining({ followerId: cy, followeeId: ana }),
    ]);
    expect(await followStudent(ana, ben)).toBe("not_found");
    expect(await followStudent(ben, ana)).toBe("not_found");

    await unblockStudent(ana, handleOf(ben));
    expect(await followStudent(ben, ana)).toBe("ok");
  });

  it("refuses a message, a reply and an offer either way, without saying why, and works again after unblocking", async () => {
    const anaPost = await newPost(ana, true);
    const benPost = await newPost(ben);
    const started = await startConversation({ senderId: ben, postId: anaPost, input: say("Is this still available?") });
    if (!started.ok) throw new Error(started.error);
    const conversationId = started.conversationId;

    await blockStudent(ana, handleOf(ben));

    const NOT_THERE = { ok: false, error: "That post could not be found." };
    expect(await startConversation({ senderId: ben, postId: anaPost, input: say("Hello?") })).toEqual(NOT_THERE);
    expect(await startConversation({ senderId: ana, postId: benPost, input: say("Hello?") })).toEqual(NOT_THERE);
    expect(await makeOffer({ responderId: ben, postId: anaPost, input: { kind: "reserve", quantity: "1", note: "" } })).toEqual(NOT_THERE);
    expect(await makeOffer({ responderId: ana, postId: benPost, input: { kind: "reserve", quantity: "1", note: "" } })).toMatchObject({ ok: false });

    // The conversation stays visible to both, read-only, with the closed-account words.
    for (const who of [ana, ben]) {
      expect((await getConversation(who, conversationId))?.readOnlyReason).toBe(CLOSED_ACCOUNT);
      expect(await sendMessage({ senderId: who, conversationId, input: say("Anyone there?") })).toEqual({ ok: false, error: CLOSED_ACCOUNT });
    }
    expect((await getConversation(ana, conversationId))?.other).toMatchObject({ id: ben, handle: handleOf(ben) });
    expect((await getConversation(ben, conversationId))?.other.id).toBe(ana);
    expect((await getConversation(ben, conversationId))?.messages).toHaveLength(1);

    await unblockStudent(ana, handleOf(ben));
    for (const who of [ana, ben]) expect((await getConversation(who, conversationId))?.readOnlyReason).toBeNull();
    expect((await sendMessage({ senderId: ben, conversationId, input: say("Back again") })).ok).toBe(true);
    expect((await sendMessage({ senderId: ana, conversationId, input: say("Welcome back") })).ok).toBe(true);
  });

  it("cancels an unsecured reservation between the two, puts the post back, and tells only the blocked person", async () => {
    const { postId, dealId } = await scheduled(ana, ben);
    expect(await postStatus(postId)).toBe("reserved");
    await db.delete(notification).where(inArray(notification.recipientId, people));

    expect(await blockStudent(ana, handleOf(ben))).toBe("ok");

    expect((await dealRow(dealId)).status).toBe("cancelled");
    expect(await postStatus(postId)).toBe("open");
    expect(await noticesFor(ben)).toEqual(["deal_cancelled"]);
    expect(await noticesFor(ana)).toEqual([]);
    expect(await noticesFor(cy)).toEqual([]);
  });

  it("alerts only the blocked person's device, and not the blocker", async () => {
    const { dealId } = await scheduled(ana, ben);
    const alerts: string[] = [];
    await blockStudent(ben, handleOf(ana), (id) => void alerts.push(id));
    expect((await dealRow(dealId)).status).toBe("cancelled");
    const [told] = await db
      .select({ id: notification.id, recipientId: notification.recipientId })
      .from(notification)
      .where(and(eq(notification.type, "deal_cancelled"), inArray(notification.recipientId, people)));
    expect(alerts).toEqual([told.id]);
    expect(told.recipientId).toBe(ana);
  });

  it("leaves a secured reservation (cash agreed) alone, and a reservation with someone else too", async () => {
    const secured = await scheduled(ana, ben);
    expect(await requestCash({ actorId: ben, dealId: secured.dealId })).toMatchObject({ ok: true });
    expect(await answerCash({ actorId: ana, dealId: secured.dealId, agree: true })).toMatchObject({ ok: true });
    const other = await scheduled(ana, cy);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await blockStudent(ben, handleOf(ana));

    expect((await dealRow(secured.dealId)).status).toBe("scheduled");
    expect(await postStatus(secured.postId)).toBe("reserved");
    expect((await dealRow(other.dealId)).status).toBe("scheduled");
    expect(await noticesFor(ana)).toEqual([]);
    expect(await noticesFor(ben)).toEqual([]);
    expect(await noticesFor(cy)).toEqual([]);
  });
});
