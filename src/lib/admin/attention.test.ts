import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { idVerification, report } from "@/db/schema";
import { getAttention } from "@/lib/admin/attention";
import { getDb, getPool } from "@/lib/db";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const a = `at-a-${run}`;
const b = `at-b-${run}`;

beforeAll(async () => {
  await createTestStudent(a, { handle: `ata_${run}` });
  await createTestStudent(b, { handle: `atb_${run}` });
}, 60_000);

afterEach(async () => {
  await db.delete(report).where(inArray(report.reporterId, [a, b]));
  await db.delete(idVerification).where(inArray(idVerification.studentId, [a, b]));
});

afterAll(async () => {
  for (const id of [a, b]) await deleteTestStudent(id);
  await getPool().end();
});

describe("what needs the owner's attention", () => {
  it("counts an open child safety report apart from other open reports, and ignores decided ones", async () => {
    const before = await getAttention();
    await db.insert(report).values({ reporterId: a, studentId: b, reason: "child_safety" });
    await db.insert(report).values({ reporterId: b, studentId: a, reason: "spam" });
    const after = await getAttention();
    expect(after.childSafetyReports).toBe(before.childSafetyReports + 1);
    expect(after.otherReports).toBe(before.otherReports + 1);

    await db.update(report).set({ status: "dismissed", handledAt: new Date() }).where(eq(report.reporterId, a));
    expect((await getAttention()).childSafetyReports).toBe(before.childSafetyReports);
  });

  it("counts ID checks that are waiting, not drafts or decided ones", async () => {
    const before = (await getAttention()).pendingIdChecks;
    await db.insert(idVerification).values({ studentId: a, status: "draft", documentKind: "school_id", claimedRole: "student", documentKey: "k/1" });
    expect((await getAttention()).pendingIdChecks).toBe(before);
    await db.update(idVerification).set({ status: "pending", holdingKey: "k/2", submittedAt: new Date() }).where(eq(idVerification.studentId, a));
    expect((await getAttention()).pendingIdChecks).toBe(before + 1);
    await db.update(idVerification).set({ status: "rejected", documentKey: null, holdingKey: null, decidedAt: new Date(), reason: "no" }).where(eq(idVerification.studentId, a));
    expect((await getAttention()).pendingIdChecks).toBe(before);
  });
});
