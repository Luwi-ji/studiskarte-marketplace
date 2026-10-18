import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { conversation, deal, follow, heart, image, notification, offer, post, pushSubscription, rateLimitEvent, session, student, verification } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { makeOffer } from "@/lib/deals/offers";
import { answerCash, requestCash } from "@/lib/deals/payment";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { DELETE_ADMIN, DELETE_CONFIRM, DELETE_NOT_ALLOWED, DELETED_NAME, deleteAccount } from "@/lib/identity/delete-account";
import type { ObjectStore } from "@/lib/images/store";
import { getConversation } from "@/lib/messaging/read";
import { CLOSED_ACCOUNT } from "@/lib/messaging/rules";
import { sendMessage } from "@/lib/messaging/send";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const gone = `da-g-${run}`;
const ana = `da-a-${run}`;
const pen = `da-p-${run}`;
const host = `da-h-${run}`;
const boss = `da-b-${run}`;
const people = [gone, ana, pen, host, boss];
const handleOf = (id: string) => id.replace(/-/g, "_");
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

const deletedKeys: string[][] = [];
const store: ObjectStore = {
  async put() {},
  async delete(keys) {
    deletedKeys.push(keys);
  },
  async signedUrl(key) {
    return `memory://${key}`;
  },
};

/** A listing by `ownerId`: free, or at ₱500 with cash in person. */
async function newPost(ownerId: string, priced = false): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `Deletion post ${run} #${counter}`,
    description: "A post for the deletion tests.",
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
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

async function reserved(postId: string, ownerId: string, responderId: string): Promise<string> {
  const made = await makeOffer({ responderId, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!made.ok) throw new Error(made.error);
  const accepted = await acceptOffer({ ownerId, offerId: made.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, made.offerId));
  return row.id;
}

function mondaySlot(): { date: string; time: string } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + i * DAY + 8 * HOUR);
    if (wall.getUTCDay() === 1) return { date: wall.toISOString().slice(0, 10), time: "09:30" };
  }
  throw new Error("no Monday in two weeks");
}

/** Scheduled, with cash in person agreed: the reservation can no longer be cancelled. */
async function secured(postId: string, ownerId: string, responderId: string): Promise<string> {
  const dealId = await reserved(postId, ownerId, responderId);
  expect(await proposeHandover({ actorId: responderId, dealId, input: { method: "meetup", ...mondaySlot(), place: "Library steps" } })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: ownerId, dealId, agree: true })).toMatchObject({ ok: true });
  expect(await requestCash({ actorId: responderId, dealId })).toMatchObject({ ok: true });
  expect(await answerCash({ actorId: ownerId, dealId, agree: true })).toMatchObject({ ok: true });
  return dealId;
}

const dealStatus = async (id: string) => (await db.select({ s: deal.status }).from(deal).where(eq(deal.id, id)))[0].s;
const postStatus = async (id: string) => (await db.select({ s: post.status }).from(post).where(eq(post.id, id)))[0].s;
const noticesFor = async (id: string) => (await db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id))).map((n) => n.type);
const confirmed = () => ({ studentId: gone, confirmHandle: `@${handleOf(gone).toUpperCase()}`, store });

beforeAll(async () => {
  await createTestStudent(gone, { handle: handleOf(gone), name: "Gina Gone" });
  await createTestStudent(ana, { handle: handleOf(ana), name: "Ana Buyer" });
  await createTestStudent(pen, { handle: handleOf(pen), name: "Pen Pending" });
  await createTestStudent(host, { handle: handleOf(host), name: "Hal Host" });
  await createTestStudent(boss, { handle: handleOf(boss), name: "Bo Admin", isAdmin: true });
}, 60_000);

afterEach(async () => {
  await db.delete(post).where(inArray(post.ownerId, people));
  await db.delete(conversation).where(or(inArray(conversation.participantA, people), inArray(conversation.participantB, people)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterAll(async () => {
  await db.delete(verification).where(eq(verification.id, `v2-${run}`));
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, `x-${gone}@testschool.edu.ph`));
  await db.update(student).set({ avatarImageId: null }).where(inArray(student.id, people));
  await db.delete(image).where(inArray(image.ownerId, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("who may delete", () => {
  it("refuses a wrong handle and an admin, and changes nothing", async () => {
    expect(await deleteAccount({ studentId: gone, confirmHandle: "someone_else", store })).toEqual({ ok: false, error: DELETE_CONFIRM });
    expect(await deleteAccount({ studentId: gone, confirmHandle: "", store })).toEqual({ ok: false, error: DELETE_CONFIRM });
    expect(await deleteAccount({ studentId: boss, confirmHandle: handleOf(boss), store })).toEqual({ ok: false, error: DELETE_ADMIN });
    expect(await deleteAccount({ studentId: randomUUID(), confirmHandle: "x", store })).toEqual({ ok: false, error: DELETE_NOT_ALLOWED });
    const [row] = await db.select({ s: student.accountStatus, h: student.handle }).from(student).where(eq(student.id, gone));
    expect(row).toEqual({ s: "active", h: handleOf(gone) });
    expect(deletedKeys).toHaveLength(0);
  });
});

describe("deleting an account", () => {
  it("erases the person, ends what is in progress, tells the others and leaves their history", async () => {
    const original = (await db.select().from(student).where(eq(student.id, gone)))[0];

    // A picture, a device, a session, a follow and a heart that must all go.
    const [avatar] = await db
      .insert(image)
      .values({ ownerId: gone, purpose: "avatar", key: `t/av-${run}`, thumbKey: `t/av-${run}-t`, width: 1, height: 1, bytes: 1 })
      .returning({ id: image.id });
    await db.update(student).set({ avatarImageId: avatar.id }).where(eq(student.id, gone));
    await db.insert(session).values({ id: `s-${run}`, userId: gone, token: `tok-${run}`, expiresAt: new Date(Date.now() + DAY) });
    await db.insert(pushSubscription).values({ studentId: gone, endpoint: `https://fcm.googleapis.com/fcm/send/${run}`, p256dh: "k", auth: "a" });
    await db.insert(follow).values([{ followerId: gone, followeeId: ana }, { followerId: ana, followeeId: gone }]);

    // Sign-in codes and limits for their address go; those of an address that only ends the same way stay.
    const lookalike = `x-${original.email}`;
    await db.insert(verification).values([
      { id: `v1-${run}`, identifier: `sign-in-otp-${original.email}`, value: "1", expiresAt: new Date(Date.now() + DAY) },
      { id: `v2-${run}`, identifier: `sign-in-otp-${lookalike}`, value: "2", expiresAt: new Date(Date.now() + DAY) },
    ]);
    await db.insert(rateLimitEvent).values([
      { action: "otp_request:email", key: original.email },
      { action: "otp_request:email", key: lookalike },
    ]);

    // Their listings: one with a pending offer, one reserved, one secured. And a reservation on someone else's listing.
    const withOffer = await newPost(gone);
    const pending = await makeOffer({ responderId: pen, postId: withOffer, input: { kind: "reserve", quantity: "1", note: "" } });
    if (!pending.ok) throw new Error(pending.error);
    const plain = await newPost(gone);
    const plainDeal = await reserved(plain, gone, ana);
    const paid = await newPost(gone, true);
    const paidDeal = await secured(paid, gone, ana);
    const hosts = await newPost(host);
    const hostsDeal = await reserved(hosts, host, gone);
    await db.insert(heart).values({ studentId: gone, postId: hosts });
    expect(await postStatus(hosts)).toBe("reserved");

    const result = await deleteAccount({ ...confirmed(), alert: undefined });
    expect(result).toEqual({ ok: true });

    // The person is erased: no email, no handle, no name, no picture, no session, no device, no follow, no heart.
    const [row] = await db.select().from(student).where(eq(student.id, gone));
    expect(row).toMatchObject({ accountStatus: "deleted", name: DELETED_NAME, handle: null, image: null, avatarImageId: null, calendarTokenHash: null, emailVerified: false });
    expect(row.email).toMatch(/^deleted\.[0-9a-f-]+@deleted\.edu\.ph$/);
    const dump = JSON.stringify(row);
    expect(dump).not.toContain(original.email);
    expect(dump).not.toContain(original.handle!);
    expect(await db.select().from(session).where(eq(session.userId, gone))).toHaveLength(0);
    expect(await db.select().from(pushSubscription).where(eq(pushSubscription.studentId, gone))).toHaveLength(0);
    expect(await db.select().from(follow).where(or(eq(follow.followerId, gone), eq(follow.followeeId, gone)))).toHaveLength(0);
    expect(await db.select().from(heart).where(eq(heart.studentId, gone))).toHaveLength(0);
    expect(await db.select().from(image).where(eq(image.id, avatar.id))).toHaveLength(0);
    expect(deletedKeys).toEqual([[`t/av-${run}`, `t/av-${run}-t`]]);
    expect((await db.select({ id: verification.id }).from(verification).where(inArray(verification.id, [`v1-${run}`, `v2-${run}`]))).map((v) => v.id)).toEqual([`v2-${run}`]);
    expect((await db.select({ key: rateLimitEvent.key }).from(rateLimitEvent).where(inArray(rateLimitEvent.key, [original.email, lookalike]))).map((r) => r.key)).toEqual([lookalike]);

    // Their listings are withdrawn; the offer on one is declined and its sender told.
    for (const id of [withOffer, plain, paid]) expect(await postStatus(id)).toBe("withdrawn");
    expect((await db.select({ s: offer.status }).from(offer).where(eq(offer.id, pending.offerId)))[0].s).toBe("declined");
    expect(await noticesFor(pen)).toContain("offer_declined");

    // A reservation being arranged is cancelled; a secured one goes to an admin. Ana is told of both.
    expect(await dealStatus(plainDeal)).toBe("cancelled");
    expect(await dealStatus(paidDeal)).toBe("disputed");
    expect(await noticesFor(ana)).toEqual(expect.arrayContaining(["deal_cancelled", "deal_disputed"]));

    // Their reservation on someone else's listing is cancelled, and the unit goes back.
    expect(await dealStatus(hostsDeal)).toBe("cancelled");
    expect(await postStatus(hosts)).toBe("open");
    expect(await noticesFor(host)).toContain("deal_cancelled");
    expect(await noticesFor(gone)).toHaveLength(0);

    // The thread stays for Ana, read-only, with a name and no handle to open.
    const [thread] = await db.select({ id: conversation.id }).from(conversation).where(or(eq(conversation.participantA, ana), eq(conversation.participantB, ana)));
    const view = await getConversation(ana, thread.id);
    expect(view?.readOnlyReason).toBe(CLOSED_ACCOUNT);
    expect(view?.other).toMatchObject({ displayName: DELETED_NAME, handle: null });
    expect(await sendMessage({ senderId: ana, conversationId: thread.id, input: { body: "Hello?" } })).toEqual({ ok: false, error: CLOSED_ACCOUNT });

    // Final: a second attempt finds nothing to delete.
    expect(await deleteAccount(confirmed())).toEqual({ ok: false, error: DELETE_NOT_ALLOWED });
  });
});
