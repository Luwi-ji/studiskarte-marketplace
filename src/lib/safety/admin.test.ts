import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent, report, session, student } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { answerCash, requestCash } from "@/lib/deals/payment";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import {
  dismissPostReports,
  dismissStudentReports,
  listAdminQueue,
  NOT_ADMIN,
  removePost,
  restorePost,
  restoreStudent,
  suspendStudent,
} from "@/lib/safety/admin";
import { reportPost, reportStudent } from "@/lib/safety/report";
import { createTestStudent, deleteTestStudent, TEST_SCHOOL } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `sf-o-${run}`;
const ana = `sf-a-${run}`;
const admin = `sf-adm-${run}`;
const otherAdmin = `sf-adm2-${run}`;
const target = `sf-t-${run}`;
const reporters = [1, 2, 3].map((n) => `sf-r${n}-${run}`);
const [r1, r2, r3] = reporters;
const people = [owner, ana, admin, otherAdmin, target, ...reporters];
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

/** A post by the owner: free, or priced with cash in person. */
async function newPost(opts: { priced?: boolean } = {}): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: owner, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `Admin post ${run} #${counter}`,
    description: "A post for the admin.",
    categoryId: "other",
    condition: null,
    priceKind: opts.priced ? "amount" : "free",
    priceAmount: opts.priced ? "500" : "",
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
  const result = await createPost({ ownerId: owner, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** A reservation by Ana, accepted by the owner. */
async function reserved(postId: string): Promise<string> {
  const offer = await makeOffer({ responderId: ana, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: owner, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  return row.id;
}

/** A coming Monday at 09:30 in the Philippines: inside the post's availability. */
function mondaySlot(): { date: string; time: string } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + i * DAY + 8 * HOUR); // the Philippine wall clock, read as UTC
    if (wall.getUTCDay() === 1) return { date: wall.toISOString().slice(0, 10), time: "09:30" };
  }
  throw new Error("no Monday in two weeks");
}

/** Cash in person agreed on a scheduled reservation: it can no longer be cancelled. */
async function secured(postId: string): Promise<string> {
  const dealId = await reserved(postId);
  const slot = mondaySlot();
  expect(await proposeHandover({ actorId: ana, dealId, input: { method: "meetup", ...slot, place: "Library steps" } })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: owner, dealId, agree: true })).toMatchObject({ ok: true });
  expect(await requestCash({ actorId: ana, dealId })).toMatchObject({ ok: true });
  expect(await answerCash({ actorId: owner, dealId, agree: true })).toMatchObject({ ok: true });
  return dealId;
}

const spam = { reason: "spam", details: "" };
const hide = async (postId: string) => {
  for (const by of reporters) await reportPost({ reporterId: by, postId, input: spam });
};
const postRow = async (id: string) => (await db.select({ status: post.status, before: post.statusBeforeHidden }).from(post).where(eq(post.id, id)))[0];
const dealStatus = async (id: string) => (await db.select({ s: deal.status }).from(deal).where(eq(deal.id, id)))[0].s;
const noticesFor = async (id: string) => (await db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id))).map((n) => n.type).sort();
const reportsOn = async (postId: string) => db.select({ status: report.status, by: report.handledBy, at: report.handledAt }).from(report).where(eq(report.postId, postId));
const accountStatus = async (id: string) => (await db.select({ s: student.accountStatus }).from(student).where(eq(student.id, id)))[0].s;

beforeAll(async () => {
  await createTestStudent(owner, { handle: `sfo_${run}`, name: "Olive Owner" });
  await createTestStudent(ana, { handle: `sfa_${run}`, name: "Ana Buyer" });
  await createTestStudent(admin, { handle: `sfadm_${run}`, name: "Ada Admin", isAdmin: true });
  await createTestStudent(otherAdmin, { handle: `sfadm2_${run}`, name: "Abe Admin", isAdmin: true });
  await createTestStudent(target, { handle: `sft_${run}`, name: "Tim Target" });
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
  await db.delete(session).where(inArray(session.userId, people));
  await db.update(student).set({ accountStatus: "active" }).where(inArray(student.id, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("who may decide", () => {
  it("refuses every function to someone who is not an admin, and changes nothing", async () => {
    const id = await newPost();
    await hide(id);
    await reportStudent({ reporterId: r1, handle: `sft_${run}`, input: spam });
    const refused = { ok: false, error: NOT_ADMIN };
    expect(await restorePost(r1, id)).toEqual(refused);
    expect(await removePost(r1, id)).toEqual(refused);
    expect(await dismissPostReports(r1, id)).toEqual(refused);
    expect(await dismissStudentReports(r1, target)).toEqual(refused);
    expect(await suspendStudent(r1, target)).toEqual(refused);
    expect(await restoreStudent(r1, target)).toEqual(refused);
    expect((await postRow(id)).status).toBe("hidden");
    expect(await accountStatus(target)).toBe("active");
    expect((await db.select({ s: report.status }).from(report).where(eq(report.studentId, target)))[0].s).toBe("open");
  });

  it("refuses an admin whose own account is suspended, and an unknown id", async () => {
    const id = await newPost();
    await hide(id);
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, admin));
    expect(await restorePost(admin, id)).toEqual({ ok: false, error: NOT_ADMIN });
    expect(await restorePost(randomUUID(), id)).toEqual({ ok: false, error: NOT_ADMIN });
  });
});

describe("restoring a hidden post", () => {
  it("puts an open post back as open, dismisses its reports and tells the owner", async () => {
    const id = await newPost();
    await hide(id);
    expect(await postRow(id)).toEqual({ status: "hidden", before: "open" });
    await db.delete(notification).where(eq(notification.recipientId, owner));

    expect(await restorePost(admin, id)).toEqual({ ok: true });
    expect(await postRow(id)).toEqual({ status: "open", before: null });
    const reports = await reportsOn(id);
    expect(reports).toHaveLength(3);
    for (const r of reports) expect(r).toMatchObject({ status: "dismissed", by: admin });
    expect(reports.every((r) => r.at !== null)).toBe(true);
    expect(await noticesFor(owner)).toEqual(["post_restored"]);
  });

  it("puts a reserved post back as reserved, with its reservation still going", async () => {
    const id = await newPost();
    const dealId = await reserved(id);
    await hide(id);
    expect(await postRow(id)).toEqual({ status: "hidden", before: "reserved" });
    expect(await restorePost(admin, id)).toEqual({ ok: true });
    expect(await postRow(id)).toEqual({ status: "reserved", before: null });
    expect(await dealStatus(dealId)).toBe("agreed");
  });

  it("needs three new reports to hide it again, not two", async () => {
    const id = await newPost();
    await hide(id);
    await restorePost(admin, id);
    expect(await reportPost({ reporterId: r1, postId: id, input: spam })).toEqual({ ok: true, hidden: false });
    expect(await reportPost({ reporterId: r2, postId: id, input: spam })).toEqual({ ok: true, hidden: false });
    expect((await postRow(id)).status).toBe("open");
    expect(await reportPost({ reporterId: r3, postId: id, input: spam })).toEqual({ ok: true, hidden: true });
    expect((await postRow(id)).status).toBe("hidden");
  });

  it("refuses a post that is not hidden or not there", async () => {
    const id = await newPost();
    expect(await restorePost(admin, id)).toMatchObject({ ok: false });
    expect(await restorePost(admin, randomUUID())).toMatchObject({ ok: false });
    expect((await postRow(id)).status).toBe("open");
  });
});

describe("removing a post", () => {
  it("cancels an unsecured reservation, tells both people and the owner, and ends the post removed", async () => {
    const id = await newPost();
    const dealId = await reserved(id);
    await hide(id);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    expect(await removePost(admin, id)).toEqual({ ok: true });
    expect(await postRow(id)).toEqual({ status: "removed", before: null });
    expect(await dealStatus(dealId)).toBe("cancelled");
    expect(await noticesFor(ana)).toEqual(["deal_cancelled"]);
    expect(await noticesFor(owner)).toEqual(["deal_cancelled", "post_removed"]);
    for (const r of await reportsOn(id)) expect(r).toMatchObject({ status: "actioned", by: admin });
  });

  it("disputes a reservation that can no longer be cancelled", async () => {
    const id = await newPost({ priced: true });
    const dealId = await secured(id);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    expect(await removePost(admin, id)).toEqual({ ok: true });
    expect(await postRow(id)).toEqual({ status: "removed", before: null });
    expect(await dealStatus(dealId)).toBe("disputed");
    expect(await noticesFor(ana)).toEqual(["deal_disputed"]);
    expect(await noticesFor(owner)).toEqual(["deal_disputed", "post_removed"]);
  });

  it("removes an open post with no reservation, and refuses one already removed", async () => {
    const id = await newPost();
    expect(await removePost(admin, id)).toEqual({ ok: true });
    expect((await postRow(id)).status).toBe("removed");
    expect(await noticesFor(owner)).toEqual(["post_removed"]);
    expect(await removePost(admin, id)).toMatchObject({ ok: false });
    expect(await removePost(admin, randomUUID())).toMatchObject({ ok: false });
    expect(await noticesFor(owner)).toEqual(["post_removed"]);
  });
});

describe("dismissing reports", () => {
  it("clears the reports on an open post and leaves it as it is", async () => {
    const id = await newPost();
    await reportPost({ reporterId: r1, postId: id, input: spam });
    await reportPost({ reporterId: r2, postId: id, input: spam });
    expect(await dismissPostReports(admin, id)).toEqual({ ok: true });
    expect((await postRow(id)).status).toBe("open");
    for (const r of await reportsOn(id)) expect(r).toMatchObject({ status: "dismissed", by: admin });
    expect(await noticesFor(owner)).toEqual([]);
  });

  it("does not dismiss the reports on a hidden post: it is restored or removed instead", async () => {
    const id = await newPost();
    await hide(id);
    expect(await dismissPostReports(admin, id)).toMatchObject({ ok: false });
    expect((await postRow(id)).status).toBe("hidden");
    expect((await reportsOn(id)).every((r) => r.status === "open")).toBe(true);
  });

  it("clears the reports about a student and leaves the account alone", async () => {
    await reportStudent({ reporterId: r1, handle: `sft_${run}`, input: spam });
    expect(await dismissStudentReports(admin, target)).toEqual({ ok: true });
    const [row] = await db.select({ status: report.status, by: report.handledBy }).from(report).where(eq(report.studentId, target));
    expect(row).toEqual({ status: "dismissed", by: admin });
    expect(await accountStatus(target)).toBe("active");
    // They may report again after the decision.
    expect(await reportStudent({ reporterId: r1, handle: `sft_${run}`, input: spam })).toMatchObject({ ok: true });
  });
});

describe("suspending a student", () => {
  const sessionFor = (userId: string) =>
    db.insert(session).values({ id: randomUUID(), userId, token: randomUUID(), expiresAt: new Date(Date.now() + DAY) });

  it("suspends, ends every session, and actions their open reports", async () => {
    await sessionFor(target);
    await sessionFor(target);
    await sessionFor(r1);
    await reportStudent({ reporterId: r1, handle: `sft_${run}`, input: spam });
    await reportStudent({ reporterId: r2, handle: `sft_${run}`, input: spam });

    expect(await suspendStudent(admin, target)).toEqual({ ok: true });
    expect(await accountStatus(target)).toBe("suspended");
    expect(await db.select({ id: session.id }).from(session).where(eq(session.userId, target))).toHaveLength(0);
    expect(await db.select({ id: session.id }).from(session).where(eq(session.userId, r1))).toHaveLength(1);
    const rows = await db.select({ status: report.status, by: report.handledBy }).from(report).where(eq(report.studentId, target));
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r).toEqual({ status: "actioned", by: admin });
    expect(await suspendStudent(admin, target)).toMatchObject({ ok: false });
  });

  it("will not suspend the admin themselves or another admin", async () => {
    expect(await suspendStudent(admin, admin)).toMatchObject({ ok: false });
    expect(await suspendStudent(admin, otherAdmin)).toMatchObject({ ok: false });
    expect(await suspendStudent(admin, `nobody-${run}`)).toMatchObject({ ok: false });
    expect(await accountStatus(admin)).toBe("active");
    expect(await accountStatus(otherAdmin)).toBe("active");
  });

  it("restores a suspended student, and only a suspended one", async () => {
    expect(await restoreStudent(admin, target)).toMatchObject({ ok: false });
    await suspendStudent(admin, target);
    expect(await restoreStudent(admin, target)).toEqual({ ok: true });
    expect(await accountStatus(target)).toBe("active");
  });
});

describe("the queue", () => {
  it("lists reported posts (hidden first), reported students and suspended students, counting reporters once and showing no email", async () => {
    const quiet = await newPost();
    const hidden = await newPost();
    await reportPost({ reporterId: r1, postId: quiet, input: { reason: "scam", details: "asks for a deposit" } });
    await hide(hidden);
    await reportStudent({ reporterId: r1, handle: `sfa_${run}`, input: spam });
    await reportStudent({ reporterId: r2, handle: `sfa_${run}`, input: { reason: "harassment", details: "rude" } });
    await suspendStudent(admin, target);

    const queue = await listAdminQueue();
    const posts = queue.posts.filter((p) => p.ownerId === owner);
    expect(posts.map((p) => p.id)).toEqual([hidden, quiet]);
    expect(posts[0]).toMatchObject({ status: "hidden", statusBeforeHidden: "open", reporterCount: 3, ownerHandle: `sfo_${run}`, ownerName: "Olive Owner" });
    expect(posts[0].reports).toHaveLength(3);
    expect(posts[0].coverThumbKey).toEqual(expect.stringContaining("t/"));
    expect(posts[1]).toMatchObject({ status: "open", statusBeforeHidden: null, reporterCount: 1 });
    expect(posts[1].reports).toMatchObject([{ reason: "scam", details: "asks for a deposit" }]);

    const students = queue.students.filter((s) => s.id === ana);
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({ handle: `sfa_${run}`, displayName: "Ana Buyer", accountStatus: "active", reporterCount: 2 });
    expect(students[0].reports.map((r) => r.reason).sort()).toEqual(["harassment", "spam"]);

    expect(queue.suspended.filter((s) => s.id === target)).toEqual([{ id: target, handle: `sft_${run}`, displayName: "Tim Target" }]);
    expect(JSON.stringify(queue)).not.toContain(`@${TEST_SCHOOL}`);
  });

  it("drops a post once its reports are decided", async () => {
    const id = await newPost();
    await reportPost({ reporterId: r1, postId: id, input: spam });
    expect((await listAdminQueue()).posts.some((p) => p.id === id)).toBe(true);
    await dismissPostReports(admin, id);
    expect((await listAdminQueue()).posts.some((p) => p.id === id)).toBe(false);
  });
});
