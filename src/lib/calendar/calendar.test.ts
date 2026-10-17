import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent, student } from "@/db/schema";
import { listHandovers, renderFeed } from "@/lib/calendar/feed";
import { createCalendarToken, hashToken, revokeCalendarToken } from "@/lib/calendar/token";
import { acceptOffer } from "@/lib/deals/accept";
import { cancelDeal } from "@/lib/deals/cancel";
import { makeOffer } from "@/lib/deals/offers";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `cal-s-${run}`;
const ana = `cal-a-${run}`;
const ben = `cal-b-${run}`;
const cat = `cal-c-${run}`;
const people = [seller, ana, ben, cat];
const origin = "https://example.test";
const DAY = 86_400_000;
const HOUR = 3_600_000;
const hashes = new Set<string>();
let counter = 0;

async function newPost(wishlist = false): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: wishlist ? "wishlist" : "showcase",
    title: `Calendar post ${run} #${counter}`,
    description: "A post to hand over.",
    categoryId: "other",
    condition: null,
    priceKind: "amount",
    priceAmount: "500",
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
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

async function reserved(buyer: string, postId: string): Promise<{ dealId: string; conversationId: string }> {
  const offer = await makeOffer({ responderId: buyer, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  return { dealId: row.id, conversationId: offer.conversationId };
}

/** A Monday at 09:30 in the Philippines, `weeksAhead` weeks after the first coming one. */
function mondaySlot(weeksAhead = 0): { date: string; time: string; at: Date } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + (i + weeksAhead * 7) * DAY + 8 * HOUR);
    if (wall.getUTCDay() === 1) {
      const date = wall.toISOString().slice(0, 10);
      return { date, time: "09:30", at: new Date(`${date}T09:30:00+08:00`) };
    }
  }
  throw new Error("no Monday in two weeks");
}

const slot = mondaySlot();
const proposal = (s = slot) => ({ method: "meetup", date: s.date, time: s.time, place: "Library steps" });

async function scheduled(buyer = ana, wishlist = false): Promise<{ dealId: string; conversationId: string; title: string }> {
  const postId = await newPost(wishlist);
  const r = await reserved(buyer, postId);
  expect(await proposeHandover({ actorId: buyer, dealId: r.dealId, input: proposal() })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: seller, dealId: r.dealId, agree: true })).toMatchObject({ ok: true });
  const [p] = await db.select({ title: post.title }).from(post).where(eq(post.id, postId));
  return { ...r, title: p.title };
}

async function link(studentId: string): Promise<string> {
  const token = await createCalendarToken(studentId);
  hashes.add(hashToken(token));
  return token;
}

const feed = (token: string) => renderFeed(`${token}.ics`, origin);
const body = async (token: string) => {
  const result = await feed(token);
  if (result.status !== 200) throw new Error(`feed answered ${result.status}`);
  return result.body;
};
const eventCount = (text: string) => (text.match(/BEGIN:VEVENT/g) ?? []).length;
/** RFC 5545 unfolding. */
const unfold = (text: string) => text.replace(/\r\n /g, "");
const sequenceOf = (text: string) => Number(/SEQUENCE:(\d+)/.exec(text)?.[1]);

beforeAll(async () => {
  await createTestStudent(seller, { handle: `cals_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `cala_${run}`, name: "Ana Buyer" });
  await createTestStudent(ben, { handle: `calb_${run}`, name: "Ben Buyer" });
  await createTestStudent(cat, { handle: `calc_${run}`, name: "Cat Third" });
}, 60_000);

afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(conversation).where(or(eq(conversation.participantA, seller), eq(conversation.participantB, seller)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  if (hashes.size) await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, [...hashes]));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("the private link", () => {
  it("is 43 URL-safe characters and only its hash is stored", async () => {
    const token = await link(ana);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [row] = await db.select({ hash: student.calendarTokenHash }).from(student).where(eq(student.id, ana));
    expect(row.hash).toBe(hashToken(token));
    expect(row.hash).not.toContain(token);
    const stored = await db.select({ id: student.id }).from(student).where(eq(student.calendarTokenHash, token));
    expect(stored).toEqual([]);
  });

  it("stops working when replaced or turned off, and a suspended student's link does not work", async () => {
    const first = await link(ana);
    expect((await feed(first)).status).toBe(200);
    const second = await link(ana);
    expect((await feed(first)).status).toBe(404);
    expect((await feed(second)).status).toBe(200);
    await revokeCalendarToken(ana);
    expect((await feed(second)).status).toBe(404);

    const third = await link(ben);
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ben));
    try {
      expect((await feed(third)).status).toBe(404);
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, ben));
    }
  });

  it("refuses a malformed file name", async () => {
    const token = await link(ana);
    expect((await renderFeed("abc.ics", origin)).status).toBe(404);
    expect((await renderFeed(token, origin)).status).toBe(404);
    expect((await renderFeed(`${token}.ical`, origin)).status).toBe(404);
  });

  it("answers 429 once the hour's limit is used up", async () => {
    const token = await link(ana);
    const key = hashToken(token);
    await db.insert(rateLimitEvent).values(Array.from({ length: 120 }, () => ({ action: "calendar_feed", key })));
    expect((await feed(token)).status).toBe(429);
    await db.delete(rateLimitEvent).where(and(eq(rateLimitEvent.action, "calendar_feed"), eq(rateLimitEvent.key, key)));
    expect((await feed(token)).status).toBe(200);
  });
});

describe("what the feed lists", () => {
  const stamp = (at: Date) => at.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const field = (text: string, name: string) => new RegExp(`${name}:(.*)`).exec(text)?.[1];

  it("has one event for a scheduled deal with the title, place and conversation, and no names or price", async () => {
    const d = await scheduled();
    const text = unfold(await body(await link(ana)));
    expect(eventCount(text)).toBe(1);
    expect(text).toContain("X-WR-CALNAME:Studiskarte transactions");
    expect(text).toContain(`UID:deal-${d.dealId}@studiskarte`);
    expect(text).toContain(`SUMMARY:Studiskarte: ${d.title}`);
    expect(text).toContain("STATUS:CONFIRMED");
    expect(text).toContain("LOCATION:Library steps");
    expect(text).toContain(`${origin}/messages/${d.conversationId}`);
    expect(text).toContain(`DTSTART:${stamp(slot.at)}`);
    expect(text).not.toMatch(/Seller|Buyer|Third|₱|PHP|\b500\b/);
  });

  it("says whether the person hands it over or receives it: the seller hands over a Showcase, the poster receives a Wishlist", async () => {
    await scheduled();
    const showcase = unfold(await body(await link(seller)));
    expect(showcase).toContain("You hand it over (Meet-up)");
    expect(unfold(await body(await link(ana)))).toContain("You receive it (Meet-up)");

    await db.delete(post).where(eq(post.ownerId, seller));
    await scheduled(ana, true);
    expect(unfold(await body(await link(seller)))).toContain("You receive it (Meet-up)");
    expect(unfold(await body(await link(ana)))).toContain("You hand it over (Meet-up)");
  });

  it("shows it to both people of the deal and nothing to a third student", async () => {
    await scheduled();
    expect(eventCount(await body(await link(ana)))).toBe(1);
    expect(eventCount(await body(await link(seller)))).toBe(1);
    const other = await body(await link(cat));
    expect(eventCount(other)).toBe(0);
    expect(other).toContain("BEGIN:VCALENDAR");
  });

  it("leaves out deals that are agreed or completed", async () => {
    const token = await link(ana);
    await reserved(ana, await newPost());
    expect(eventCount(await body(token))).toBe(0);

    const done = await scheduled();
    const at = new Date();
    await db
      .update(deal)
      .set({ status: "completed", ownerConfirmedAt: at, responderConfirmedAt: at, paidAt: at, paymentMethod: "cash", paymentConfirmedAt: at })
      .where(eq(deal.id, done.dealId));
    expect(eventCount(await body(token))).toBe(0);
  });

  it("keeps a cancelled or disputed deal for 30 days as a cancelled event with the same UID and a higher SEQUENCE", async () => {
    const token = await link(ana);
    const first = await scheduled();
    const before = await body(token);
    expect(eventCount(before)).toBe(1);

    expect(await cancelDeal({ actorId: ana, dealId: first.dealId })).toMatchObject({ ok: true });
    const after = unfold(await body(token));
    expect(eventCount(after)).toBe(1);
    expect(field(after, "UID")).toBe(field(before, "UID"));
    expect(after).toContain("STATUS:CANCELLED");
    expect(after).not.toContain("STATUS:CONFIRMED");
    expect(after).toContain(`SUMMARY:Cancelled: Studiskarte: ${first.title}`);
    expect(sequenceOf(after)).toBeGreaterThan(sequenceOf(before));
    // The seller's calendar drops it the same way.
    expect(unfold(await body(await link(seller)))).toContain("STATUS:CANCELLED");

    const second = await scheduled();
    await db.update(deal).set({ status: "disputed" }).where(eq(deal.id, second.dealId));
    const both = await body(token);
    expect(eventCount(both)).toBe(2);
    expect(both.match(/STATUS:CANCELLED/g)).toHaveLength(2);

    // Thirty days after it ended, it is gone from the feed.
    await db.update(deal).set({ activityAt: new Date(Date.now() - 31 * DAY) }).where(eq(deal.id, first.dealId));
    const later = unfold(await body(token));
    expect(eventCount(later)).toBe(1);
    expect(later).toContain(`UID:deal-${second.dealId}@studiskarte`);
  });

  it("downloads one deal for its people, cancelled ones included, and for nobody else", async () => {
    const d = await scheduled();
    const one = { dealId: d.dealId };
    expect(await listHandovers(ana, origin, one)).toHaveLength(1);
    expect(await listHandovers(seller, origin, one)).toHaveLength(1);
    expect(await listHandovers(cat, origin, one)).toEqual([]);

    expect(await cancelDeal({ actorId: ana, dealId: d.dealId })).toMatchObject({ ok: true });
    await db.update(deal).set({ activityAt: new Date(Date.now() - 90 * DAY) }).where(eq(deal.id, d.dealId));
    const [event] = await listHandovers(ana, origin, one);
    expect(event.status).toBe("cancelled");
    expect(await listHandovers(cat, origin, one)).toEqual([]);

    // A deal that never had a time has nothing to download.
    const agreed = await reserved(ben, await newPost());
    expect(await listHandovers(ben, origin, { dealId: agreed.dealId })).toEqual([]);
  });

  it("moves the same event and raises SEQUENCE when the time is changed", async () => {
    const d = await scheduled();
    const token = await link(ana);
    const before = await body(token);
    // Calendar apps compare SEQUENCE in whole seconds; make the first change clearly older.
    await db.update(deal).set({ updatedAt: new Date(Date.now() - 60_000) }).where(eq(deal.id, d.dealId));
    const older = await body(token);

    const later = mondaySlot(1);
    expect(await proposeHandover({ actorId: ana, dealId: d.dealId, input: proposal(later) })).toMatchObject({ ok: true });
    expect(await answerProposal({ actorId: seller, dealId: d.dealId, agree: true })).toMatchObject({ ok: true });
    const after = await body(token);

    expect(field(after, "UID")).toBe(field(before, "UID"));
    expect(field(after, "DTSTART")).not.toBe(field(older, "DTSTART"));
    expect(field(after, "DTSTART")).toBe(stamp(later.at));
    expect(sequenceOf(after)).toBeGreaterThan(sequenceOf(older));
  });
});
