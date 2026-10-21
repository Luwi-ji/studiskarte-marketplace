import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent, report, student } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { ALREADY_REPORTED, CANT_REPORT_SELF, REPORT_HIDE_THRESHOLD, REPORT_REASONS, REPORT_TARGET_GONE, REPORTING_TOO_FAST, REPORTS_PER_HOUR, reportPost, reportStudent } from "@/lib/safety/report";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `sf-o-${run}`;
const buyer = `sf-b-${run}`;
const reporters = [1, 2, 3, 4].map((n) => `sf-r${n}-${run}`);
const [r1, r2, r3, r4] = reporters;
const people = [owner, buyer, ...reporters];
let counter = 0;

/** A free post by the owner. */
async function newPost(): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: owner, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `Report post ${run} #${counter}`,
    description: "A post to report.",
    categoryId: "other",
    condition: null,
    priceKind: "free",
    priceAmount: "",
    paymentCash: true,
    paymentOnline: false,
    paymentOther: false,
    paymentNote: "",
    quantity: "1",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Main gate",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: owner, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

const spam = { reason: "spam", details: "" };
const postRow = async (id: string) => (await db.select({ status: post.status, before: post.statusBeforeHidden }).from(post).where(eq(post.id, id)))[0];
const hiddenNotices = async () =>
  db.select({ id: notification.id }).from(notification).where(and(eq(notification.recipientId, owner), eq(notification.type, "post_hidden")));
const openReports = async (postId: string) =>
  db.select({ id: report.id }).from(report).where(and(eq(report.postId, postId), eq(report.status, "open")));

beforeAll(async () => {
  await createTestStudent(owner, { handle: `sfo_${run}`, name: "Olive Owner" });
  await createTestStudent(buyer, { handle: `sfb_${run}`, name: "Bea Buyer" });
  for (const [i, id] of reporters.entries()) await createTestStudent(id, { handle: `sfr${i + 1}_${run}`, name: `Reporter ${i + 1}` });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(report).where(or(inArray(report.reporterId, people), inArray(report.studentId, people)));
  await db.delete(post).where(eq(post.ownerId, owner));
  await db.delete(conversation).where(or(eq(conversation.participantA, owner), eq(conversation.participantB, owner)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  await db.update(student).set({ accountStatus: "active" }).where(inArray(student.id, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("what a report may be", () => {
  it("offers the eight reasons the database accepts, child safety first", () => {
    expect(REPORT_REASONS.map((r) => r.id)).toEqual(["child_safety", "spam", "scam", "prohibited", "offensive", "harassment", "impersonation", "other"]);
    expect(REPORT_REASONS.every((r) => r.label.length > 0)).toBe(true);
  });

  it("refuses an unknown reason, a missing one and too long details", async () => {
    const id = await newPost();
    for (const input of [{ reason: "boring" }, {}, null, "spam", { reason: "spam", details: "x".repeat(501) }]) {
      expect(await reportPost({ reporterId: r1, postId: id, input })).toMatchObject({ ok: false });
    }
    expect(await openReports(id)).toHaveLength(0);
  });

  it("stores trimmed details, and none when blank", async () => {
    const id = await newPost();
    expect(await reportPost({ reporterId: r1, postId: id, input: { reason: "scam", details: "  asks for a deposit  " } })).toEqual({ ok: true, hidden: false });
    expect(await reportPost({ reporterId: r2, postId: id, input: { reason: "scam", details: "   " } })).toEqual({ ok: true, hidden: false });
    const rows = await db.select({ by: report.reporterId, details: report.details }).from(report).where(eq(report.postId, id));
    expect(rows.find((r) => r.by === r1)?.details).toBe("asks for a deposit");
    expect(rows.find((r) => r.by === r2)?.details).toBeNull();
  });

  it("refuses reporting your own post", async () => {
    const id = await newPost();
    expect(await reportPost({ reporterId: owner, postId: id, input: spam })).toEqual({ ok: false, error: CANT_REPORT_SELF });
    expect(await openReports(id)).toHaveLength(0);
  });

  it("refuses a post that does not exist", async () => {
    expect(await reportPost({ reporterId: r1, postId: randomUUID(), input: spam })).toEqual({ ok: false, error: REPORT_TARGET_GONE });
    expect(await reportPost({ reporterId: r1, postId: "not-an-id", input: spam })).toEqual({ ok: false, error: REPORT_TARGET_GONE });
  });

  it("refuses a second open report on the same post", async () => {
    const id = await newPost();
    expect(await reportPost({ reporterId: r1, postId: id, input: spam })).toMatchObject({ ok: true });
    expect(await reportPost({ reporterId: r1, postId: id, input: { reason: "scam" } })).toEqual({ ok: false, error: ALREADY_REPORTED });
    expect(await openReports(id)).toHaveLength(1);
  });

  it("lets someone report again once the earlier report was decided", async () => {
    const id = await newPost();
    await reportPost({ reporterId: r1, postId: id, input: spam });
    await db.update(report).set({ status: "dismissed", handledBy: owner, handledAt: new Date() }).where(eq(report.postId, id));
    expect(await reportPost({ reporterId: r1, postId: id, input: spam })).toMatchObject({ ok: true });
  });

  it("refuses a student reporting themselves, and one who is not there", async () => {
    expect(await reportStudent({ reporterId: r1, handle: `sfr1_${run}`, input: spam })).toEqual({ ok: false, error: CANT_REPORT_SELF });
    expect(await reportStudent({ reporterId: r1, handle: `nobody_${run}`, input: spam })).toEqual({ ok: false, error: REPORT_TARGET_GONE });
    expect(await reportStudent({ reporterId: r1, handle: `sfr2_${run}`, input: { reason: "boring" } })).toMatchObject({ ok: false });
    expect(await db.select({ id: report.id }).from(report).where(eq(report.reporterId, r1))).toHaveLength(0);
  });

  it("reports a student by handle (with or without @ and in any case) once, until decided", async () => {
    expect(await reportStudent({ reporterId: r1, handle: `@SFR2_${run}`, input: { reason: "harassment", details: "rude messages" } })).toEqual({ ok: true, hidden: false });
    expect(await reportStudent({ reporterId: r1, handle: `sfr2_${run}`, input: spam })).toEqual({ ok: false, error: ALREADY_REPORTED });
    const [row] = await db.select().from(report).where(eq(report.reporterId, r1));
    expect(row).toMatchObject({ studentId: r2, postId: null, reason: "harassment", details: "rude messages", status: "open" });
  });

  it("does not suspend anyone however many reports a student gets", async () => {
    for (const by of [r1, r2, r3, r4]) expect(await reportStudent({ reporterId: by, handle: `sfo_${run}`, input: spam })).toMatchObject({ ok: true, hidden: false });
    const [row] = await db.select({ status: student.accountStatus }).from(student).where(eq(student.id, owner));
    expect(row.status).toBe("active");
  });
});

describe("hiding a post", () => {
  it("keeps the threshold at three", () => {
    expect(REPORT_HIDE_THRESHOLD).toBe(3);
  });

  it("hides at once on a single child safety report", async () => {
    const id = await newPost();
    expect(await reportPost({ reporterId: r1, postId: id, input: { reason: "child_safety" } })).toEqual({ ok: true, hidden: true });
    expect(await postRow(id)).toEqual({ status: "hidden", before: "open" });
  });

  it("does not hide on two reports, hides on the third different student, and tells the owner once", async () => {
    const id = await newPost();
    const alerts: string[] = [];
    expect(await reportPost({ reporterId: r1, postId: id, input: spam, alert: (n) => alerts.push(n) })).toEqual({ ok: true, hidden: false });
    expect(await reportPost({ reporterId: r2, postId: id, input: spam, alert: (n) => alerts.push(n) })).toEqual({ ok: true, hidden: false });
    expect(await postRow(id)).toEqual({ status: "open", before: null });
    expect(await hiddenNotices()).toHaveLength(0);

    expect(await reportPost({ reporterId: r3, postId: id, input: spam, alert: (n) => alerts.push(n) })).toEqual({ ok: true, hidden: true });
    expect(await postRow(id)).toEqual({ status: "hidden", before: "open" });
    const notices = await hiddenNotices();
    expect(notices).toHaveLength(1);
    expect(alerts).toEqual([notices[0].id]);

    // Nobody can report a hidden post any more, so there is no second notice.
    expect(await reportPost({ reporterId: r4, postId: id, input: spam })).toEqual({ ok: false, error: REPORT_TARGET_GONE });
    expect(await hiddenNotices()).toHaveLength(1);
  });

  it("hides a reserved post and lets its reservation carry on", async () => {
    const id = await newPost();
    const offer = await makeOffer({ responderId: buyer, postId: id, input: { kind: "reserve", quantity: "1", note: "" } });
    if (!offer.ok) throw new Error(offer.error);
    const accepted = await acceptOffer({ ownerId: owner, offerId: offer.offerId });
    if (!accepted.ok) throw new Error(accepted.error);
    expect((await postRow(id)).status).toBe("reserved");

    for (const by of [r1, r2]) await reportPost({ reporterId: by, postId: id, input: spam });
    expect(await reportPost({ reporterId: r3, postId: id, input: spam })).toEqual({ ok: true, hidden: true });
    expect(await postRow(id)).toEqual({ status: "hidden", before: "reserved" });
    const [reservation] = await db.select({ status: deal.status }).from(deal).where(eq(deal.offerId, offer.offerId));
    expect(reservation.status).toBe("agreed");
  });

  it("does not count reports from a suspended account", async () => {
    const id = await newPost();
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, r3));
    for (const by of [r1, r2, r3]) expect(await reportPost({ reporterId: by, postId: id, input: spam })).toMatchObject({ ok: true, hidden: false });
    expect((await postRow(id)).status).toBe("open");
    expect(await reportPost({ reporterId: r4, postId: id, input: spam })).toEqual({ ok: true, hidden: true });
    expect((await postRow(id)).status).toBe("hidden");
  });

  it("hides exactly once when three reports arrive together", async () => {
    const id = await newPost();
    const results = await Promise.all([r1, r2, r3].map((by) => reportPost({ reporterId: by, postId: id, input: spam })));
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && r.hidden)).toHaveLength(1);
    expect(await postRow(id)).toEqual({ status: "hidden", before: "open" });
    expect(await hiddenNotices()).toHaveLength(1);
  });

  it("stops one student flooding the queue with reports", async () => {
    const gone = { reason: "spam", details: "" };
    for (let n = 0; n < REPORTS_PER_HOUR; n++) {
      expect(await reportStudent({ reporterId: r1, handle: `nobody_${run}_${n}`, input: gone })).toEqual({ ok: false, error: REPORT_TARGET_GONE });
    }
    expect(await reportStudent({ reporterId: r1, handle: `nobody_${run}`, input: gone })).toEqual({ ok: false, error: REPORTING_TOO_FAST });
    expect(await reportPost({ reporterId: r1, postId: randomUUID(), input: gone })).toEqual({ ok: false, error: REPORTING_TOO_FAST });
    // Someone else is not held back by it.
    expect(await reportStudent({ reporterId: r2, handle: `nobody_${run}`, input: gone })).toEqual({ ok: false, error: REPORT_TARGET_GONE });
  });
});
