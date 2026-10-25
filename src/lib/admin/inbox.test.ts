import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { contactMessage, perkSuggestion, perkVote } from "@/db/schema";
import { deleteContactMessage, getInbox } from "@/lib/admin/inbox";
import { getDb } from "@/lib/db";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 6);
const admin = `inbox-admin-${run}`;
const member = `inbox-member-${run}`;
const shop = `Zzz Cafe ${run}`;
const messageIds: string[] = [];
let voteIds: string[] = [];

afterAll(async () => {
  await db.delete(perkSuggestion).where(inArray(perkSuggestion.shop, [shop, shop.toUpperCase(), `  ${shop} `]));
  if (voteIds.length > 0) await db.delete(perkVote).where(inArray(perkVote.id, voteIds));
  if (messageIds.length > 0) await db.delete(contactMessage).where(inArray(contactMessage.id, messageIds));
  await deleteTestStudent(admin);
  await deleteTestStudent(member);
});

describe("admin inbox", () => {
  it("counts the same shop once however it was typed, and counts votes per kind", async () => {
    await db.insert(perkSuggestion).values([{ shop }, { shop: shop.toUpperCase() }, { shop: `  ${shop} ` }]);
    const before = (await getInbox()).votes.find((v) => v.kind === "printing")?.count ?? 0;
    voteIds = (await db.insert(perkVote).values([{ kind: "printing" }, { kind: "printing" }]).returning({ id: perkVote.id })).map((v) => v.id);

    const inbox = await getInbox();
    expect(inbox.suggestions.filter((s) => s.shop.toLowerCase().trim() === shop.toLowerCase())).toEqual([expect.objectContaining({ count: 3 })]);
    expect(inbox.votes.find((v) => v.kind === "printing")?.count).toBe(before + 2);
    expect(inbox.votes.map((v) => v.kind).sort()).toEqual(["clothes", "food", "other", "printing", "services"]);
  });

  it("lets an admin delete a message and nobody else", async () => {
    await createTestStudent(admin, { isAdmin: true });
    await createTestStudent(member);
    const [row] = await db.insert(contactMessage).values({ name: null, email: `a${run}@example.com`, message: "Hello there" }).returning({ id: contactMessage.id });
    messageIds.push(row.id);

    expect(await deleteContactMessage(member, row.id)).toEqual({ ok: false, error: "Only an admin can do this." });
    expect(await db.select().from(contactMessage).where(eq(contactMessage.id, row.id))).toHaveLength(1);

    expect(await deleteContactMessage(admin, row.id)).toEqual({ ok: true });
    expect(await db.select().from(contactMessage).where(eq(contactMessage.id, row.id))).toHaveLength(0);
  });
});
