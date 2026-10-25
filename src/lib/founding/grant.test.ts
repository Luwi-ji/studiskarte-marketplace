import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, isNotNull } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { FOUNDING_OPENS_AT } from "./config";
import { grantFoundingSeller } from "./grant";

const run = Math.random().toString(36).slice(2, 8);
const ids = [1, 2, 3].map((n) => `founding-${run}-${n}`);
const guest = `founding-${run}-guest`;
const db = getDb();
const after = new Date(FOUNDING_OPENS_AT.getTime() + 60_000);

const badged = async () => (await db.select({ n: count() }).from(student).where(isNotNull(student.foundingSellerAt)))[0].n;

beforeAll(async () => {
  for (const id of ids) await createTestStudent(id);
  await createTestStudent(guest, { visitor: true });
});

afterAll(async () => {
  for (const id of [...ids, guest]) await deleteTestStudent(id);
  await getPool().end();
});

describe("Founding Seller grant", () => {
  it("gives nothing before the opening date", async () => {
    expect(await grantFoundingSeller(ids[0], new Date(FOUNDING_OPENS_AT.getTime() - 1))).toBe(false);
  });

  it("never gives more places than the limit, even with sign-ups at once", async () => {
    const limit = (await badged()) + 2;
    const results = await Promise.all(ids.map((id) => grantFoundingSeller(id, after, limit)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await badged()).toBe(limit);
  });

  it("is not given to a guest, nor twice", async () => {
    const limit = Number.MAX_SAFE_INTEGER;
    expect(await grantFoundingSeller(guest, after, limit)).toBe(false);
    const already = (await Promise.all(ids.map((id) => grantFoundingSeller(id, after, limit)))).filter(Boolean);
    expect(already).toHaveLength(1); // only the one that lost the race earlier; the other two already hold it
  });
});
