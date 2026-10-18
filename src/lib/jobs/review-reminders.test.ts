import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post, rateLimitEvent } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { confirmHandover } from "@/lib/deals/confirm";
import { makeOffer } from "@/lib/deals/offers";
import { submitReview } from "@/lib/deals/review";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { sendReviewReminders } from "@/lib/jobs/review-reminders";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `rv-rs-${run}`;
const ana = `rv-ra-${run}`;
const people = [seller, ana];
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

/** A free post owned by the seller. */
async function newPost(): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title: `Review reminder post ${run} #${counter}`,
    description: "A post to hand over.",
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
    // Mondays 09:00 to 10:00, Philippine time.
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: seller, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

/** The coming Monday at 09:30 in the Philippines: inside the post's availability. */
function mondaySlot(): { date: string; time: string; at: Date } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + i * DAY + 8 * HOUR); // the Philippine wall clock, read as UTC
    if (wall.getUTCDay() === 1) {
      const date = wall.toISOString().slice(0, 10);
      return { date, time: "09:30", at: new Date(`${date}T09:30:00+08:00`) };
    }
  }
  throw new Error("no Monday in two weeks");
}

const slot = mondaySlot();
const after = new Date(slot.at.getTime() + HOUR);
const noticesFor = async (id: string) => (await db.select({ type: notification.type }).from(notification).where(eq(notification.recipientId, id))).map((n) => n.type);

/** A completed deal whose completion is `ago` milliseconds in the past. */
async function completedAgo(ago: number): Promise<string> {
  const offer = await makeOffer({ responderId: ana, postId: await newPost(), input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  expect(await proposeHandover({ actorId: ana, dealId: row.id, input: { method: "meetup", date: slot.date, time: slot.time, place: "Library steps" } })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: seller, dealId: row.id, agree: true })).toMatchObject({ ok: true });
  await confirmHandover({ actorId: ana, dealId: row.id, now: after });
  await confirmHandover({ actorId: seller, dealId: row.id, now: after });
  await db.update(deal).set({ updatedAt: new Date(Date.now() - ago) }).where(eq(deal.id, row.id));
  expect((await db.select({ s: deal.status }).from(deal).where(eq(deal.id, row.id)))[0].s).toBe("completed");
  return row.id;
}

beforeAll(async () => {
  await createTestStudent(seller, { handle: `rsell_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `rana_${run}`, name: "Ana Buyer" });
}, 60_000);

beforeEach(async () => {
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(conversation).where(or(eq(conversation.participantA, seller), eq(conversation.participantB, seller)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("review reminders", () => {
  it("tell both people once, a day or more after the deal completed", async () => {
    await completedAgo(2 * DAY);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendReviewReminders();
    expect(await noticesFor(ana)).toEqual(["deal_review_reminder"]);
    expect(await noticesFor(seller)).toEqual(["deal_review_reminder"]);

    await sendReviewReminders();
    expect(await noticesFor(ana)).toEqual(["deal_review_reminder"]);
    expect(await noticesFor(seller)).toEqual(["deal_review_reminder"]);
  });

  it("skip whoever has already reviewed", async () => {
    const dealId = await completedAgo(2 * DAY);
    expect(await submitReview({ actorId: ana, dealId, input: { rating: 5 } })).toMatchObject({ ok: true });
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendReviewReminders();
    expect(await noticesFor(ana)).toEqual([]);
    expect(await noticesFor(seller)).toEqual(["deal_review_reminder"]);
  });

  it("wait for a full day", async () => {
    await completedAgo(6 * HOUR);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendReviewReminders();
    expect(await noticesFor(ana)).toEqual([]);
    expect(await noticesFor(seller)).toEqual([]);
  });

  it("leave old deals alone", async () => {
    await completedAgo(20 * DAY);
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendReviewReminders();
    expect(await noticesFor(ana)).toEqual([]);
    expect(await noticesFor(seller)).toEqual([]);
  });
});
