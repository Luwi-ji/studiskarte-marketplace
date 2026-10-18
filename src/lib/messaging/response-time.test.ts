import { randomUUID } from "node:crypto";
import { inArray, or } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { conversation, message } from "@/db/schema";
import { getDb } from "@/lib/db";
import { bucketOf, getReplyTime } from "@/lib/messaging/response-time";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 6);
const me = `rt-me-${run}`;
const others = Array.from({ length: 6 }, (_, i) => `rt-o${i}-${run}`);
const people = [me, ...others];

const HOUR = 3_600_000;
const now = new Date();
const ago = (hours: number) => new Date(now.getTime() - hours * HOUR);

// One conversation between me and `other`. `firstBy` writes first, `hoursAgo`
// is the age of that message; `replyAfter` (hours) is my answer, if any.
async function talk(
  other: string,
  opts: { firstBy?: string; hoursAgo: number; replyAfter?: number },
): Promise<void> {
  const [a, b] = me < other ? [me, other] : [other, me];
  const [row] = await db.insert(conversation).values({ participantA: a, participantB: b }).returning({ id: conversation.id });
  const first = opts.firstBy ?? other;
  const sentAt = ago(opts.hoursAgo);
  await db.insert(message).values({ conversationId: row.id, senderId: first, body: "Hi", createdAt: sentAt });
  if (opts.replyAfter !== undefined) {
    const replier = first === me ? other : me;
    await db.insert(message).values({
      conversationId: row.id,
      senderId: replier,
      body: "Hello",
      createdAt: new Date(sentAt.getTime() + opts.replyAfter * HOUR),
    });
  }
}

async function clear(): Promise<void> {
  await db.delete(conversation).where(or(inArray(conversation.participantA, people), inArray(conversation.participantB, people)));
}

describe("bucketOf", () => {
  it("cuts at 1, 6 and 24 hours", () => {
    expect(bucketOf(0.5)).toBe("hour");
    expect(bucketOf(1)).toBe("hour");
    expect(bucketOf(1.01)).toBe("few_hours");
    expect(bucketOf(6)).toBe("few_hours");
    expect(bucketOf(24)).toBe("day");
    expect(bucketOf(24.01)).toBe("few_days");
  });
});

describe("getReplyTime", () => {
  beforeAll(async () => {
    for (const id of people) await createTestStudent(id);
  });

  afterEach(clear);

  afterAll(async () => {
    await clear();
    for (const id of people) await deleteTestStudent(id);
  });

  it("shows nothing under five qualifying conversations, then the median bucket", async () => {
    for (const other of others.slice(0, 4)) await talk(other, { hoursAgo: 50, replyAfter: 0.5 });
    expect(await getReplyTime(me, now)).toBeNull();

    await talk(others[4], { hoursAgo: 50, replyAfter: 3 });
    expect(await getReplyTime(me, now)).toBe("hour");

    await clear();
    for (const other of others.slice(0, 2)) await talk(other, { hoursAgo: 50, replyAfter: 0.5 });
    for (const other of others.slice(2, 5)) await talk(other, { hoursAgo: 50, replyAfter: 3 });
    expect(await getReplyTime(me, now)).toBe("few_hours");
  });

  it("ignores conversations the student started", async () => {
    for (const other of others.slice(0, 4)) await talk(other, { hoursAgo: 50, replyAfter: 0.5 });
    await talk(others[4], { firstBy: me, hoursAgo: 50, replyAfter: 0.5 });
    expect(await getReplyTime(me, now)).toBeNull();
  });

  it("ignores a first message still waiting for an answer inside 72 hours", async () => {
    for (const other of others.slice(0, 4)) await talk(other, { hoursAgo: 50, replyAfter: 0.5 });
    await talk(others[4], { hoursAgo: 71 });
    expect(await getReplyTime(me, now)).toBeNull();
  });

  it("counts a first message unanswered for over 72 hours as a few days", async () => {
    for (const other of others.slice(0, 5)) await talk(other, { hoursAgo: 73 });
    expect(await getReplyTime(me, now)).toBe("few_days");
  });

  it("ignores a first message older than 30 days", async () => {
    for (const other of others.slice(0, 4)) await talk(other, { hoursAgo: 50, replyAfter: 0.5 });
    await talk(others[4], { hoursAgo: 31 * 24, replyAfter: 0.5 });
    expect(await getReplyTime(me, now)).toBeNull();
  });
});
