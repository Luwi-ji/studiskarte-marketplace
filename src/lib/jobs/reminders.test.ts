import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { conversation, deal, image, notification, post } from "@/db/schema";
import { acceptOffer } from "@/lib/deals/accept";
import { formatHandoverTime } from "@/lib/deals/handover";
import { makeOffer } from "@/lib/deals/offers";
import { answerProposal, proposeHandover } from "@/lib/deals/schedule";
import { getDb, getPool } from "@/lib/db";
import { sendHandoverReminders } from "@/lib/jobs/reminders";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

// These tests make many round trips to the database; give them room.
vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const seller = `rem-s-${run}`;
const ana = `rem-a-${run}`;
const people = [seller, ana];
const DAY = 86_400_000;
const HOUR = 3_600_000;
let counter = 0;

async function newPost(opts: { wishlist?: boolean } = {}): Promise<string> {
  counter += 1;
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: seller, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: opts.wishlist ? "wishlist" : "showcase",
    title: `Reminder post ${run} #${counter}`,
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

/** A Monday at 09:30 in the Philippines, `weeksAhead` weeks after the first coming one: inside the post's availability. */
function mondaySlot(weeksAhead = 0): { date: string; time: string; at: Date } {
  for (let i = 1; i <= 14; i++) {
    const wall = new Date(Date.now() + (i + weeksAhead * 7) * DAY + 8 * HOUR); // the Philippine wall clock, read as UTC
    if (wall.getUTCDay() === 1) {
      const date = wall.toISOString().slice(0, 10);
      return { date, time: "09:30", at: new Date(`${date}T09:30:00+08:00`) };
    }
  }
  throw new Error("no Monday in two weeks");
}

const slot = mondaySlot();
const proposal = (s = slot) => ({ method: "meetup", date: s.date, time: s.time, place: "Library steps" });
const dealRow = async (id: string) => (await db.select().from(deal).where(eq(deal.id, id)))[0];

/** A scheduled handover at the slot, agreed by Ana (proposes) and the seller (agrees). */
async function scheduled(opts: { wishlist?: boolean } = {}): Promise<string> {
  const postId = await newPost(opts);
  const offer = await makeOffer({ responderId: ana, postId, input: { kind: "reserve", quantity: "1", note: "" } });
  if (!offer.ok) throw new Error(offer.error);
  const accepted = await acceptOffer({ ownerId: seller, offerId: offer.offerId });
  if (!accepted.ok) throw new Error(accepted.error);
  const [row] = await db.select({ id: deal.id }).from(deal).where(eq(deal.offerId, offer.offerId));
  expect(await proposeHandover({ actorId: ana, dealId: row.id, input: proposal() })).toMatchObject({ ok: true });
  expect(await answerProposal({ actorId: seller, dealId: row.id, agree: true })).toMatchObject({ ok: true });
  return row.id;
}

/** What a person was reminded of, oldest first. */
async function remindedOf(id: string): Promise<{ type: string; detail: string | null }[]> {
  const rows = await db
    .select({ type: notification.type, detail: notification.detail })
    .from(notification)
    .where(eq(notification.recipientId, id))
    .orderBy(notification.createdAt, notification.id);
  return rows.filter((n) => n.type === "deal_reminder" || n.type === "deal_confirm_reminder");
}
const types = async (id: string) => (await remindedOf(id)).map((n) => n.type);

beforeAll(async () => {
  await createTestStudent(seller, { handle: `rems_${run}`, name: "Sam Seller" });
  await createTestStudent(ana, { handle: `rema_${run}`, name: "Ana Buyer" });
}, 60_000);

afterEach(async () => {
  await db.delete(post).where(eq(post.ownerId, seller));
  await db.delete(conversation).where(or(eq(conversation.participantA, seller), eq(conversation.participantB, seller)));
  await db.delete(notification).where(inArray(notification.recipientId, people));
});

afterAll(async () => {
  await db.delete(image).where(inArray(image.ownerId, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("reminders before the handover", () => {
  const before = (ms: number, at = slot.at) => new Date(at.getTime() - ms);

  it("reminds both a day and two hours before, once each, with the time and place", async () => {
    const dealId = await scheduled();
    await db.delete(notification).where(inArray(notification.recipientId, people));
    const detail = `${formatHandoverTime(slot.at)} · Library steps`;

    await sendHandoverReminders(before(2 * DAY));
    expect(await types(ana)).toEqual([]);
    const dayBefore = before(23 * HOUR);
    await sendHandoverReminders(dayBefore);
    await sendHandoverReminders(before(22 * HOUR));
    expect(await remindedOf(ana)).toEqual([{ type: "deal_reminder", detail }]);
    expect(await remindedOf(seller)).toEqual([{ type: "deal_reminder", detail }]);
    expect((await dealRow(dealId)).activityAt).toEqual(dayBefore);

    // Three hours before is not yet the two-hour reminder (the old one-hour reminder is gone too).
    await sendHandoverReminders(before(3 * HOUR));
    expect(await types(ana)).toEqual(["deal_reminder"]);
    await sendHandoverReminders(before(110 * 60_000));
    await sendHandoverReminders(before(10 * 60_000));
    expect(await remindedOf(ana)).toEqual([
      { type: "deal_reminder", detail },
      { type: "deal_reminder", detail },
    ]);
    expect(await types(seller)).toEqual(["deal_reminder", "deal_reminder"]);

    // After the time there is no "before" reminder.
    await sendHandoverReminders(new Date(slot.at.getTime() + HOUR));
    expect(await types(ana)).toHaveLength(2);
    expect((await dealRow(dealId)).status).toBe("scheduled");
  });

  it("reminds again for a new time, with the new time", async () => {
    const dealId = await scheduled();
    await db.delete(notification).where(inArray(notification.recipientId, people));
    await sendHandoverReminders(before(23 * HOUR));
    expect(await types(ana)).toEqual(["deal_reminder"]);

    const later = mondaySlot(1);
    expect(await proposeHandover({ actorId: ana, dealId, input: proposal(later) })).toMatchObject({ ok: true });
    expect(await answerProposal({ actorId: seller, dealId, agree: true })).toMatchObject({ ok: true });
    await sendHandoverReminders(before(23 * HOUR, later.at));
    const reminders = (await remindedOf(ana)).filter((n) => n.type === "deal_reminder");
    expect(reminders.at(-1)?.detail).toBe(`${formatHandoverTime(later.at)} · Library steps`);
    expect(reminders.length).toBeGreaterThanOrEqual(2);
  });
});

describe("reminders after the handover", () => {
  const later = (days: number) => new Date(slot.at.getTime() + days * DAY + HOUR);
  const confirmed = new Date(slot.at.getTime() + HOUR);

  it("reminds only the one who has not confirmed, 1 and 3 days after, and nobody when neither has", async () => {
    const dealId = await scheduled();
    await db.delete(notification).where(inArray(notification.recipientId, people));

    // Nobody has confirmed: no reminder to confirm.
    await sendHandoverReminders(later(1));
    expect(await types(ana)).toEqual([]);

    await db.update(deal).set({ ownerConfirmedAt: confirmed }).where(eq(deal.id, dealId));
    await sendHandoverReminders(later(0));
    expect(await types(ana)).toEqual([]);
    await sendHandoverReminders(later(1));
    await sendHandoverReminders(later(1));
    expect(await remindedOf(ana)).toEqual([{ type: "deal_confirm_reminder", detail: `${formatHandoverTime(slot.at)} · Library steps` }]);
    expect(await types(seller)).toEqual([]);
    await sendHandoverReminders(later(3));
    expect(await types(ana)).toEqual(["deal_confirm_reminder", "deal_confirm_reminder"]);
  });

  it("reminds whoever the payment is waiting on once both confirmed the handover, a day and three days later, without repeating", async () => {
    const dealId = await scheduled();
    await db.update(deal).set({ ownerConfirmedAt: confirmed, responderConfirmedAt: confirmed }).where(eq(deal.id, dealId));
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendHandoverReminders(later(0));
    expect(await types(ana)).toEqual([]);
    expect(await types(seller)).toEqual([]);

    // Nothing is paid: the buyer (who pays for a Showcase) is reminded, the seller is not.
    await sendHandoverReminders(later(1));
    await sendHandoverReminders(later(1));
    expect(await types(ana)).toEqual(["deal_confirm_reminder"]);
    expect(await types(seller)).toEqual([]);

    // The buyer says they paid: now it waits on the seller, who is reminded at the next time.
    await db.update(deal).set({ paidAt: confirmed, paymentMethod: "cash" }).where(eq(deal.id, dealId));
    await sendHandoverReminders(later(3));
    expect(await types(seller)).toEqual(["deal_confirm_reminder"]);
    expect(await types(ana)).toEqual(["deal_confirm_reminder"]);
    await sendHandoverReminders(later(3));
    expect(await types(seller)).toHaveLength(1);
  });

  it("sends only the latest reminder that is due after a long gap, and none for a free deal or a settled payment", async () => {
    const dealId = await scheduled();
    await db.update(deal).set({ ownerConfirmedAt: confirmed, responderConfirmedAt: confirmed }).where(eq(deal.id, dealId));
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendHandoverReminders(later(5));
    expect(await types(ana)).toEqual(["deal_confirm_reminder"]);

    await db.delete(notification).where(inArray(notification.recipientId, people));
    await db.update(deal).set({ amount: 0 }).where(eq(deal.id, dealId));
    await sendHandoverReminders(later(5));
    expect(await types(ana)).toEqual([]);

    await db.update(deal).set({ amount: 500, paidAt: confirmed, paymentMethod: "cash", paymentConfirmedAt: confirmed }).where(eq(deal.id, dealId));
    await sendHandoverReminders(later(5));
    expect(await types(ana)).toEqual([]);
    expect(await types(seller)).toEqual([]);
  });

  it("asks the poster to pay on a Wishlist: the one who posted it pays, the one who supplies it is paid", async () => {
    const dealId = await scheduled({ wishlist: true });
    await db.update(deal).set({ ownerConfirmedAt: confirmed, responderConfirmedAt: confirmed }).where(eq(deal.id, dealId));
    await db.delete(notification).where(inArray(notification.recipientId, people));

    await sendHandoverReminders(later(1));
    expect(await types(seller)).toEqual(["deal_confirm_reminder"]);
    expect(await types(ana)).toEqual([]);
  });
});
