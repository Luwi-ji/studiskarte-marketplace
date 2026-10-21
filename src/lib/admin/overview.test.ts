import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { conversation, conversationListing, deal, image, offer, post, review, school, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import type { Role } from "@/lib/identity/roles";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { TEST_SCHOOL } from "@/test/fixtures";
import { photosOf } from "@/test/photos";
import { getOverview } from "./overview";

// The window is in 2001, where the shared dev database has nothing else, so the day-by-day numbers can be
// checked exactly. All-time totals depend on whatever else is in the database and are checked by shape.
// Manila is UTC+8: "T16:00:00Z" is midnight of the next Manila day.
const NOW = new Date("2001-03-12T03:00:00Z"); // 11:00 on Mar 12 in Manila

const db = getDb();
const run = randomUUID().slice(0, 6);
const id = (name: string) => `ov-${name}-${run}`;
const at = (iso: string) => new Date(iso);
const days = (points: { day: string; total: number }[]) => Object.fromEntries(points.filter((p) => p.total > 0).map((p) => [p.day, p.total]));

const people = [id("s1"), id("s2"), id("s3"), id("s4"), id("s5"), id("s6"), id("s7"), id("owner"), id("buyer")];
const postIds: string[] = [];
const conversationIds: string[] = [];
let categoryIds: string[] = [];

async function account(name: string, role: Role, createdAt: string, status = "active") {
  const visitor = role === "visitor";
  const email = visitor ? `${id(name)}@visitor.test` : `${id(name)}@${TEST_SCHOOL}`;
  await db.insert(student).values({
    id: id(name),
    email,
    emailVerified: true,
    ...(visitor ? {} : { schoolDomain: TEST_SCHOOL, schoolEmail: email }),
    role,
    accountStatus: status,
    createdAt: at(createdAt),
  });
}

async function listing(owner: string, kind: "showcase" | "wishlist", createdAt: string, categoryId: string): Promise<string> {
  const [row] = await db
    .insert(post)
    .values({
      ownerId: owner,
      kind,
      title: `Overview ${run}`,
      description: "A listing for the overview test.",
      categoryId,
      priceKind: "free",
      exchangeMeetup: true,
      exchangeDelivery: false,
      meetupLocation: "Main gate",
      quantity: 100,
      status: "withdrawn",
      listedAt: at(createdAt),
      createdAt: at(createdAt),
      expiresAt: at("2001-12-31T00:00:00Z"),
    })
    .returning({ id: post.id });
  postIds.push(row.id);
  return row.id;
}

beforeAll(async () => {
  await db.insert(school).values({ domain: TEST_SCHOOL }).onConflictDoNothing();
  categoryIds = (await db.execute<{ id: string }>(sql`select id from category where not requires_condition order by position limit 2`)).rows.map((r) => r.id);
  expect(categoryIds).toHaveLength(2);

  // Accounts around the edges of the 7-day window (Mar 6 to Mar 12, Manila).
  await account("s1", "student", "2001-03-05T15:59:59Z"); // Mar 5, 23:59:59 in Manila: the day before the window
  await account("s2", "student", "2001-03-05T16:00:00Z"); // Mar 6, 00:00:00: first moment of the window
  await account("s3", "faculty", "2001-03-10T15:59:59Z"); // Mar 10, 23:59:59
  await account("s4", "student", "2001-03-10T16:00:00Z"); // Mar 11, 00:00:00
  await account("s5", "visitor", "2001-03-12T02:59:59Z", "suspended"); // Mar 12, one second before "now"
  await account("s6", "alumni", "2001-03-12T03:00:00Z"); // exactly now: not yet in the period
  await account("s7", "staff", "2001-03-13T00:00:00Z"); // the future
  await account("owner", "student", "2001-01-01T00:00:00Z");
  await account("buyer", "student", "2001-01-01T00:00:00Z");

  const [other, main] = categoryIds;
  const owner = id("owner");
  const buyer = id("buyer");
  // Too young for the first-message shares (younger than 7 days at NOW), but inside the window.
  const young = await listing(owner, "showcase", "2001-03-10T16:00:00Z", main); // Mar 11
  await listing(owner, "wishlist", "2001-03-10T15:59:59Z", main); // Mar 10
  await listing(owner, "showcase", "2001-03-05T10:00:00Z", other); // Mar 5, 18:00 in Manila: before the 7-day window, and too young for the 30-day cohort
  // The 30-day cohort: old enough, with first messages after 2 h, 30 h, 9 days and never.
  const q1 = await listing(owner, "showcase", "2001-02-20T00:00:00Z", other);
  const q2 = await listing(owner, "wishlist", "2001-02-21T00:00:00Z", other);
  const q3 = await listing(owner, "showcase", "2001-02-22T00:00:00Z", main);
  const q4 = await listing(owner, "showcase", "2001-02-23T00:00:00Z", main);

  const [first, second] = [owner, buyer].sort();
  const [thread] = await db
    .insert(conversation)
    .values({ participantA: first, participantB: second, createdAt: at("2001-03-10T16:00:00Z"), lastMessageAt: at("2001-03-10T16:00:00Z") })
    .returning({ id: conversation.id });
  conversationIds.push(thread.id);
  await db.insert(conversationListing).values([
    { conversationId: thread.id, postId: q1, createdAt: at("2001-02-20T02:00:00Z") },
    { conversationId: thread.id, postId: q2, createdAt: at("2001-02-22T06:00:00Z") },
    { conversationId: thread.id, postId: q3, createdAt: at("2001-03-03T00:00:00Z") },
    { conversationId: thread.id, postId: young, createdAt: at("2001-03-11T00:00:00Z") },
  ]);

  const offerOn = async (postId: string, fields: { createdAt: string; isReserve: boolean; status: string }) => {
    const [row] = await db
      .insert(offer)
      .values({
        conversationId: thread.id,
        postId,
        responderId: buyer,
        amount: fields.isReserve ? 0 : 100,
        isReserve: fields.isReserve,
        status: fields.status,
        decidedAt: fields.status === "pending" ? null : at(fields.createdAt),
        expiresAt: at("2001-12-31T00:00:00Z"),
        createdAt: at(fields.createdAt),
      })
      .returning({ id: offer.id });
    return row.id;
  };
  const dealOn = async (postId: string, offerId: string, fields: { createdAt: string; status: string; ownerConfirmedAt?: string; responderConfirmedAt?: string }) => {
    const done = fields.status === "completed";
    const [row] = await db
      .insert(deal)
      .values({
        postId,
        offerId,
        ownerId: owner,
        responderId: buyer,
        amount: 0,
        status: fields.status,
        ...(done ? { handoverMethod: "meetup", scheduledAt: at("2001-03-11T01:00:00Z"), place: "Library steps" } : {}),
        ownerConfirmedAt: fields.ownerConfirmedAt ? at(fields.ownerConfirmedAt) : null,
        responderConfirmedAt: fields.responderConfirmedAt ? at(fields.responderConfirmedAt) : null,
        createdAt: at(fields.createdAt),
      })
      .returning({ id: deal.id });
    return row.id;
  };

  // Offers: Mar 11, Mar 12, Mar 8, Mar 9. Reservations (accepted offers): Mar 11 (completed on Mar 12), Mar 8 (cancelled), Mar 9 (still going).
  const o1 = await offerOn(q1, { createdAt: "2001-03-10T16:00:00Z", isReserve: true, status: "accepted" });
  await offerOn(q1, { createdAt: "2001-03-12T01:00:00Z", isReserve: false, status: "declined" });
  const o3 = await offerOn(q2, { createdAt: "2001-03-08T04:00:00Z", isReserve: true, status: "accepted" });
  const o4 = await offerOn(q4, { createdAt: "2001-03-09T04:00:00Z", isReserve: true, status: "accepted" });
  // The second person confirms at 00:30 on Mar 12 in Manila, so the deal completes on the day after it was made.
  const completed = await dealOn(q1, o1, {
    createdAt: "2001-03-10T16:00:00Z",
    status: "completed",
    ownerConfirmedAt: "2001-03-11T10:00:00Z",
    responderConfirmedAt: "2001-03-11T16:30:00Z",
  });
  await dealOn(q2, o3, { createdAt: "2001-03-08T04:00:00Z", status: "cancelled" });
  await dealOn(q4, o4, { createdAt: "2001-03-09T04:00:00Z", status: "agreed" });

  await db.insert(review).values([
    { dealId: completed, reviewerId: owner, revieweeId: buyer, rating: 5, createdAt: at("2001-03-12T01:00:00Z") },
    { dealId: completed, reviewerId: buyer, revieweeId: owner, rating: 4, createdAt: at("2001-03-11T20:00:00Z") }, // 04:00 on Mar 12 in Manila
  ]);
}, 120_000);

afterAll(async () => {
  // Posts take their offers, reservations, reviews and thread links with them; threads take their messages.
  await db.delete(post).where(inArray(post.id, postIds));
  await db.delete(conversation).where(inArray(conversation.id, conversationIds));
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(student).where(inArray(student.id, people));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
}, 120_000);

describe("getOverview: Manila day buckets", () => {
  it("covers each Manila day of the period, oldest first, up to the day of now", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    expect(o.period).toEqual({ days: 7, from: "2001-03-06", to: "2001-03-12" });
    expect(o.accounts.dailyByRole.map((p) => p.day)).toEqual(["2001-03-06", "2001-03-07", "2001-03-08", "2001-03-09", "2001-03-10", "2001-03-11", "2001-03-12"]);
  });

  it("puts accounts made just before and just after Manila midnight on different days", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    // s1 (Mar 5, 23:59:59) is outside; s2 is on the first day; s3 and s4 straddle Mar 10/11; s5 is on Mar 12; s6 is at "now" and s7 is later.
    expect(days(o.accounts.dailyByRole)).toEqual({ "2001-03-06": 1, "2001-03-10": 1, "2001-03-11": 1, "2001-03-12": 1 });
    expect(o.accounts.newInPeriod).toBe(4);
  });

  it("splits new accounts by role and by status", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    const byDay = Object.fromEntries(o.accounts.dailyByRole.map((p) => [p.day, p.parts]));
    expect(byDay["2001-03-06"]).toEqual({ student: 1, faculty: 0, staff: 0, alumni: 0, visitor: 0 });
    expect(byDay["2001-03-10"]).toEqual({ student: 0, faculty: 1, staff: 0, alumni: 0, visitor: 0 });
    expect(byDay["2001-03-12"]).toEqual({ student: 0, faculty: 0, staff: 0, alumni: 0, visitor: 1 });
    const status = Object.fromEntries(o.accounts.dailyByStatus.map((p) => [p.day, p.parts]));
    expect(status["2001-03-12"]).toEqual({ active: 0, suspended: 1, deleted: 0 });
    expect(status["2001-03-06"]).toEqual({ active: 1, suspended: 0, deleted: 0 });
  });

  it("buckets listings by the Manila day they were made, split Showcase and Wishlist", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    expect(days(o.listings.dailyByKind)).toEqual({ "2001-03-10": 1, "2001-03-11": 1 });
    const byDay = Object.fromEntries(o.listings.dailyByKind.map((p) => [p.day, p.parts]));
    expect(byDay["2001-03-10"]).toEqual({ showcase: 0, wishlist: 1 });
    expect(byDay["2001-03-11"]).toEqual({ showcase: 1, wishlist: 0 });
    expect(o.listings.createdInPeriod).toBe(2);
  });

  it("counts conversations, offers and reservations on the day they began", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    expect(days(o.conversations.daily)).toEqual({ "2001-03-11": 1 });
    expect(days(o.offers.daily)).toEqual({ "2001-03-08": 1, "2001-03-09": 1, "2001-03-11": 1, "2001-03-12": 1 });
    expect(o.offers.madeInPeriod).toBe(4);
    expect(days(o.reservations.daily)).toEqual({ "2001-03-08": 1, "2001-03-09": 1, "2001-03-11": 1 });
    expect(o.reservations.madeInPeriod).toBe(3);
  });

  it("counts a deal on the Manila day the second person confirmed, not the day it was made", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    expect(days(o.deals.daily)).toEqual({ "2001-03-12": 1 });
    expect(o.deals.completedInPeriod).toBe(1);
  });

  it("counts reviews by Manila day and averages their stars", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    expect(days(o.reviews.daily)).toEqual({ "2001-03-12": 2 });
    expect(o.reviews.givenInPeriod).toBe(2);
    expect(o.reviews.averageStars).toBe(4.5);
  });

  it("lists categories by listings made in the period, most first, at most 10", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    expect(o.listings.byCategory).toEqual([{ id: categoryIds[1], name: expect.any(String), count: 2 }]);
    const wide = await getOverview({ days: 90, now: NOW });
    const counts = wide.listings.byCategory.map((c) => c.count);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(counts.length).toBeLessThanOrEqual(10);
    expect(Object.fromEntries(wide.listings.byCategory.map((c) => [c.id, c.count]))).toMatchObject({ [categoryIds[0]]: 3, [categoryIds[1]]: 4 });
  });
});

describe("getOverview: all-time numbers", () => {
  it("adds up roles and statuses to the same total, and has every key", async () => {
    const o = await getOverview({ days: 30 });
    expect(Object.keys(o.accounts.byRole).sort()).toEqual(["alumni", "faculty", "staff", "student", "visitor"]);
    expect(Object.keys(o.accounts.byStatus).sort()).toEqual(["active", "deleted", "suspended"]);
    const roles = Object.values(o.accounts.byRole).reduce((a, b) => a + b, 0);
    const statuses = Object.values(o.accounts.byStatus).reduce((a, b) => a + b, 0);
    expect(roles).toBe(o.accounts.total);
    expect(statuses).toBe(o.accounts.total);
    // Our seeded accounts are in it: 9 here, including one suspended visitor and one faculty.
    expect(o.accounts.total).toBeGreaterThanOrEqual(9);
    expect(o.accounts.byRole.visitor).toBeGreaterThanOrEqual(1);
    expect(o.accounts.byStatus.suspended).toBeGreaterThanOrEqual(1);
  });

  it("counts an open listing as active now and a withdrawn one as not", async () => {
    const before = (await getOverview({ days: 7, now: NOW })).listings.activeNow;
    await listing(id("owner"), "showcase", "2000-01-01T00:00:00Z", categoryIds[0]);
    expect((await getOverview({ days: 7, now: NOW })).listings.activeNow).toBe(before);

    const key = randomUUID();
    const [photo] = await db
      .insert(image)
      .values({ ownerId: id("owner"), purpose: "post_photo", key: `t/${key}`, thumbKey: `t/${key}-t`, width: 1, height: 1, bytes: 1 })
      .returning({ id: image.id });
    const input: NewPostInput = {
      kind: "showcase",
      title: `Open ${run}`,
      description: "An open listing for the overview test.",
      categoryId: categoryIds[0],
      condition: null,
      priceKind: "free",
      priceAmount: "",
      paymentCash: false,
      paymentOnline: false,
      paymentOther: false,
      paymentNote: "",
      quantity: "1",
      exchangeMeetup: true,
      exchangeDelivery: false,
      meetupLocation: "Main gate",
      availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      photos: photosOf([photo.id]),
    };
    const created = await createPost({ ownerId: id("owner"), input });
    if (!created.ok) throw new Error(JSON.stringify(created.errors));
    postIds.push(created.id);
    expect((await getOverview({ days: 7, now: NOW })).listings.activeNow).toBe(before + 1);
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, created.id));
    expect((await getOverview({ days: 7, now: NOW })).listings.activeNow).toBe(before);
  });

  it("lists at most 10 schools, most first, with the name or the domain to show", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    for (const list of [o.schools.byAccounts, o.schools.byListings]) {
      expect(list.length).toBeLessThanOrEqual(10);
      expect(list.map((s) => s.count)).toEqual([...list.map((s) => s.count)].sort((a, b) => b - a));
      for (const s of list) expect(s.id).toMatch(/\.edu\.ph$/);
    }
  });
});

describe("getOverview: marketplace health", () => {
  it("computes the shares and the median from the listings old enough to judge", async () => {
    // 30 days back from NOW: four listings are 7+ days old (2 h, 30 h, 9 days, never), one is too young.
    const o = await getOverview({ days: 30, now: NOW });
    expect(o.health.listingsWithMessage).toEqual({ numerator: 2, denominator: 4, share: 0.5 });
    expect(o.health.medianHoursToFirstMessage).toBe(30);
    // Reservations made in the period that ended: one completed, one cancelled. The one still going is not counted.
    expect(o.health.reservationsCompleted).toEqual({ numerator: 1, denominator: 2, share: 0.5 });
  });

  it("gives null, never NaN or Infinity, when there is nothing to divide by", async () => {
    const quiet = await getOverview({ days: 30, now: new Date("2002-06-01T00:00:00Z") });
    expect(quiet.health.listingsWithMessage).toEqual({ numerator: 0, denominator: 0, share: null });
    expect(quiet.health.reservationsCompleted).toEqual({ numerator: 0, denominator: 0, share: null });
    expect(quiet.health.medianHoursToFirstMessage).toBeNull();
    expect(quiet.reviews.averageStars).toBeNull();
    expect(quiet.reviews.givenInPeriod).toBe(0);
    expect(quiet.accounts.newInPeriod).toBe(0);
    expect(quiet.listings.byCategory).toEqual([]);
    expect(quiet.accounts.dailyByRole).toHaveLength(30);
    expect(quiet.accounts.dailyByRole.every((p) => p.total === 0)).toBe(true);
  });

  it("only leaves a share null when its denominator is zero", async () => {
    const o = await getOverview({ days: 7, now: NOW });
    for (const r of [o.health.listingsWithMessage, o.health.reservationsCompleted]) {
      expect(r.share === null).toBe(r.denominator === 0);
      if (r.share !== null) expect(Number.isFinite(r.share)).toBe(true);
    }
  });
});
