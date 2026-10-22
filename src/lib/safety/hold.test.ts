import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { adminAction, post, report, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { DELETE_HELD, deleteAccount } from "@/lib/identity/delete-account";
import type { ObjectStore } from "@/lib/images/store";
import { liftLegalHold, NOT_ADMIN, placeLegalHold } from "@/lib/safety/admin";
import { underLegalHold } from "@/lib/safety/hold";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const target = `lh-t-${run}`;
const reporter = `lh-r-${run}`;
const admin = `lh-a-${run}`;
const people = [target, reporter, admin];
const store: ObjectStore = { put: async () => {}, delete: async () => {}, signedUrl: async () => "" };
const handle = `lht_${run}`;

beforeAll(async () => {
  await createTestStudent(target, { handle, name: "Held Person" });
  await createTestStudent(reporter, { handle: `lhr_${run}` });
  await createTestStudent(admin, { handle: `lha_${run}`, isAdmin: true });
}, 60_000);

afterEach(async () => {
  await db.delete(report).where(inArray(report.reporterId, people));
  await db.delete(post).where(eq(post.ownerId, target));
  await db.delete(adminAction).where(inArray(adminAction.adminId, people));
  await db.update(student).set({ legalHoldAt: null, accountStatus: "active" }).where(inArray(student.id, people));
});

afterAll(async () => {
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
});

/** A withdrawn listing by the target (a direct insert: open ones need availability). */
async function listing(): Promise<string> {
  const [row] = await db
    .insert(post)
    .values({ ownerId: target, kind: "showcase", title: `Hold ${run}`, description: "x", categoryId: "other", priceKind: "free", exchangeMeetup: true, exchangeDelivery: false, meetupLocation: "Gate", status: "withdrawn" })
    .returning({ id: post.id });
  return row.id;
}

const tryDelete = () => deleteAccount({ studentId: target, confirmHandle: handle, store });

describe("what holds an account", () => {
  it("holds on a child safety report about the person, or about one of their listings, open or acted on", async () => {
    expect(await underLegalHold(db, target)).toBe(false);
    const postId = await listing();
    const [r] = await db.insert(report).values({ reporterId: reporter, postId, reason: "child_safety" }).returning({ id: report.id });
    expect(await underLegalHold(db, target)).toBe(true);
    await db.update(report).set({ status: "actioned", handledBy: admin, handledAt: new Date() }).where(eq(report.id, r.id));
    expect(await underLegalHold(db, target)).toBe(true);
    await db.delete(report).where(eq(report.id, r.id));
    await db.insert(report).values({ reporterId: reporter, studentId: target, reason: "child_safety" });
    expect(await underLegalHold(db, target)).toBe(true);
  });

  it("does not hold on a dismissed child safety report or on any other reason", async () => {
    const postId = await listing();
    await db.insert(report).values({ reporterId: reporter, postId, reason: "spam" });
    expect(await underLegalHold(db, target)).toBe(false);
    await db.delete(report).where(eq(report.reporterId, reporter));
    await db.insert(report).values({ reporterId: reporter, postId, reason: "child_safety", status: "dismissed", handledBy: admin, handledAt: new Date() });
    expect(await underLegalHold(db, target)).toBe(false);
  });
});

describe("deleting an account under a hold", () => {
  it("is refused with a message that says nothing about why, and changes nothing", async () => {
    const postId = await listing();
    await db.insert(report).values({ reporterId: reporter, postId, reason: "child_safety" });
    expect(await tryDelete()).toEqual({ ok: false, error: DELETE_HELD });
    expect(DELETE_HELD).not.toMatch(/child|safety|report|police|authorit/i);
    const [row] = await db.select({ status: student.accountStatus, handle: student.handle }).from(student).where(eq(student.id, target));
    expect(row).toEqual({ status: "active", handle });
  });

  it("is refused under an owner hold, allowed once it is lifted, and the person can then delete", async () => {
    expect(await placeLegalHold(admin, target, "Lawful order received")).toEqual({ ok: true });
    expect(await tryDelete()).toEqual({ ok: false, error: DELETE_HELD });
    expect(await liftLegalHold(admin, target, "Order withdrawn")).toEqual({ ok: true });
    expect(await tryDelete()).toEqual({ ok: true });
  });
});

describe("placing and lifting a hold", () => {
  it("needs an admin and a reason, writes the record, and refuses lifting a hold that was never placed", async () => {
    expect(await placeLegalHold(reporter, target, "because")).toEqual({ ok: false, error: NOT_ADMIN });
    expect(await placeLegalHold(admin, target, "   ")).toMatchObject({ ok: false });
    expect(await placeLegalHold(admin, target, "x".repeat(301))).toMatchObject({ ok: false });
    expect(await liftLegalHold(admin, target)).toMatchObject({ ok: false });
    expect(await db.select().from(adminAction).where(inArray(adminAction.adminId, people))).toEqual([]);

    expect(await placeLegalHold(admin, target, "Child safety case")).toEqual({ ok: true });
    expect(await liftLegalHold(admin, target)).toEqual({ ok: true });
    const rows = await db.select({ action: adminAction.action, reason: adminAction.reason, studentId: adminAction.studentId }).from(adminAction).where(eq(adminAction.adminId, admin));
    expect(rows.map((r) => [r.action, r.reason, r.studentId]).sort()).toEqual([
      ["lift_legal_hold", null, target],
      ["place_legal_hold", "Child safety case", target],
    ]);
  });
});
