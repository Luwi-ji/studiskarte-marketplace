import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { post, report } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { getModerationCounts } from "./moderation";

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `mo-owner-${run}`;
const suspended = `mo-sus-${run}`;
const deleted = `mo-del-${run}`;
const reporter = `mo-rep-${run}`;
const people = [owner, suspended, deleted, reporter];

afterAll(async () => {
  await db.delete(report).where(inArray(report.reporterId, people));
  await db.delete(post).where(eq(post.ownerId, owner));
  for (const who of people) await deleteTestStudent(who);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
}, 60_000);

describe("getModerationCounts", () => {
  it("counts open reports, hidden posts, and suspended and deleted accounts", async () => {
    const before = await getModerationCounts();
    for (const n of Object.values(before)) expect(Number.isInteger(n) && n >= 0).toBe(true);

    await createTestStudent(owner, { handle: `mo_o_${run}` });
    await createTestStudent(suspended, { accountStatus: "suspended" });
    await createTestStudent(deleted, { accountStatus: "deleted" });
    await createTestStudent(reporter);
    const [hidden] = await db
      .insert(post)
      .values({
        ownerId: owner,
        kind: "showcase",
        title: `Hidden ${run}`,
        description: "A hidden post for the moderation counts.",
        categoryId: "other",
        priceKind: "free",
        exchangeMeetup: true,
        exchangeDelivery: false,
        meetupLocation: "Main gate",
        status: "hidden",
        statusBeforeHidden: "open",
      })
      .returning({ id: post.id });
    await db.insert(report).values([
      { reporterId: reporter, postId: hidden.id, reason: "spam" }, // open, about a post
      { reporterId: reporter, studentId: owner, reason: "other" }, // open, about a student
      { reporterId: owner, studentId: reporter, reason: "other", status: "dismissed", handledBy: reporter, handledAt: new Date() }, // decided: not counted
    ]);

    const after = await getModerationCounts();
    expect(after.openReports - before.openReports).toBe(2);
    expect(after.hiddenPosts - before.hiddenPosts).toBe(1);
    expect(after.suspendedAccounts - before.suspendedAccounts).toBe(1);
    expect(after.deletedAccounts - before.deletedAccounts).toBe(1);
  });
});
