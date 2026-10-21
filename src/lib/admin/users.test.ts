import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { report, school, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { createTestStudent, deleteTestStudent, TEST_SCHOOL } from "@/test/fixtures";
import { listUsers, parsePage, parseSearch, USER_SEARCH_MAX_LENGTH, USERS_PAGE_SIZE } from "./users";

const db = getDb();
const run = randomUUID().slice(0, 6);
const id = (name: string) => `us-${name}-${run}`;
// Every name below starts with the run id, so a search for it finds only these accounts.
const MANY = 27;
const manyIds = Array.from({ length: MANY }, (_, i) => id(`m${String(i).padStart(2, "0")}`));
const special = { percent: id("pct"), plain: id("plain"), under: id("under"), other: id("other"), slash: id("slash"), reported: id("rep"), reporter: id("reporter") };
const people = [...manyIds, ...Object.values(special)];

beforeAll(async () => {
  await db.insert(school).values({ domain: TEST_SCHOOL }).onConflictDoNothing();
  const email = (who: string) => `${who}@${TEST_SCHOOL}`;
  // 27 accounts a minute apart, newest last in the list.
  await db.insert(student).values(
    manyIds.map((who, i) => ({
      id: who,
      email: email(who),
      emailVerified: true,
      schoolDomain: TEST_SCHOOL,
      schoolEmail: email(who),
      name: `${run} many ${i}`,
      createdAt: new Date(Date.UTC(2001, 0, 1, 0, i)),
    })),
  );
  await createTestStudent(special.percent, { name: `${run} 100% sure` });
  await createTestStudent(special.plain, { name: `${run} 100 sure` });
  await createTestStudent(special.under, { name: `${run} a_b` });
  await createTestStudent(special.other, { name: `${run} axb` });
  await createTestStudent(special.slash, { name: `${run} back\\slash` });
  await createTestStudent(special.reported, { name: `${run} reported`, handle: `rp_${run}` });
  await createTestStudent(special.reporter, { name: `${run} reporter` });
  await db.insert(report).values({ reporterId: special.reporter, studentId: special.reported, reason: "spam", status: "open" });
  await db.insert(report).values({ reporterId: special.other, studentId: special.reported, reason: "other", status: "dismissed", handledBy: special.other, handledAt: new Date() });
}, 120_000);

afterAll(async () => {
  await db.delete(report).where(inArray(report.reporterId, people));
  for (const who of people) await deleteTestStudent(who);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
}, 120_000);

describe("parsePage and parseSearch", () => {
  it("accepts a whole page number from 1 and treats anything else as page 1", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["4", "5"])).toBe(4);
    for (const bad of [undefined, "", "0", "-1", "1.5", "abc", "1e3", " 2", "2 ", "NaN", "Infinity", "99999999999999999999"]) {
      // "99999999999999999999" has too many digits to be a page; "0" is below the first page.
      expect(parsePage(bad)).toBe(1);
    }
    expect(parsePage("9999999")).toBe(1_000_000);
  });

  it("trims, drops a leading @ and cuts to the maximum length", () => {
    expect(parseSearch(undefined)).toBe("");
    expect(parseSearch("  @ana  ")).toBe("ana");
    expect(parseSearch(["x", "y"])).toBe("x");
    expect(parseSearch("a".repeat(USER_SEARCH_MAX_LENGTH + 50))).toHaveLength(USER_SEARCH_MAX_LENGTH);
  });
});

describe("listUsers: pagination", () => {
  it("gives 25 per page, newest first, with the total and page count", async () => {
    const first = await listUsers({ search: run, page: 1 });
    expect(USERS_PAGE_SIZE).toBe(25);
    expect(first.total).toBe(MANY + 7);
    expect(first.totalPages).toBe(2);
    expect(first.page).toBe(1);
    expect(first.rows).toHaveLength(25);
    const times = first.rows.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    // The seven accounts made now come before the 27 made in 2001.
    expect(first.rows.slice(0, 7).every((r) => r.createdAt.getFullYear() > 2001)).toBe(true);
  });

  it("gives the rest on the last page and never repeats a row", async () => {
    const first = await listUsers({ search: run, page: 1 });
    const second = await listUsers({ search: run, page: 2 });
    expect(second.page).toBe(2);
    expect(second.rows).toHaveLength(MANY + 7 - 25);
    const ids = [...first.rows, ...second.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(MANY + 7);
  });

  it("fits a page number outside the pages that exist into them", async () => {
    const beyond = await listUsers({ search: run, page: 99 });
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(MANY + 7 - 25);
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 1.9]) {
      const result = await listUsers({ search: run, page: bad });
      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.page).toBeLessThanOrEqual(result.totalPages);
      expect(result.rows.length).toBeLessThanOrEqual(25);
    }
  });

  it("gives one empty page when nothing matches", async () => {
    const none = await listUsers({ search: `${run}-nobody-has-this`, page: 7 });
    expect(none).toMatchObject({ total: 0, totalPages: 1, page: 1, rows: [] });
  });
});

describe("listUsers: search", () => {
  it("matches part of a handle, a name or an email, whatever the case", async () => {
    expect((await listUsers({ search: `RP_${run}` })).rows.map((r) => r.id)).toEqual([special.reported]);
    expect((await listUsers({ search: `@rp_${run}` })).rows.map((r) => r.id)).toEqual([special.reported]);
    expect((await listUsers({ search: `${run} REPORTED` })).rows.map((r) => r.id)).toEqual([special.reported]);
    expect((await listUsers({ search: id("rep") })).rows.map((r) => r.id)).toEqual([special.reported]); // the email starts with the id
  });

  it("treats % as a plain character", async () => {
    const found = await listUsers({ search: `${run} 100%` });
    expect(found.rows.map((r) => r.id)).toEqual([special.percent]);
    // Alone, % is not "everyone": it finds only names, handles and emails that contain a percent sign.
    const alone = await listUsers({ search: "%" });
    expect(alone.rows.every((r) => `${r.handle ?? ""}${r.displayName}${r.email}`.includes("%"))).toBe(true);
    expect(alone.rows.map((r) => r.id)).toContain(special.percent);
    expect(alone.rows.map((r) => r.id)).not.toContain(special.plain);
  });

  it("treats _ as a plain character", async () => {
    const found = await listUsers({ search: `${run} a_b` });
    expect(found.rows.map((r) => r.id)).toEqual([special.under]);
    const alone = await listUsers({ search: "_" });
    expect(alone.rows.every((r) => `${r.handle ?? ""}${r.displayName}${r.email}`.includes("_"))).toBe(true);
  });

  it("treats a backslash as a plain character", async () => {
    expect((await listUsers({ search: `${run} back\\slash` })).rows.map((r) => r.id)).toEqual([special.slash]);
    expect((await listUsers({ search: `${run} back\\` })).rows.map((r) => r.id)).toEqual([special.slash]);
    expect((await listUsers({ search: "\\" })).rows.every((r) => `${r.handle ?? ""}${r.displayName}${r.email}`.includes("\\"))).toBe(true);
  });

  it("lists everyone, newest first, for an empty search", async () => {
    const all = await listUsers({ search: "   " });
    expect(all.search).toBe("");
    expect(all.total).toBeGreaterThanOrEqual(MANY + 7);
  });
});

describe("listUsers: what a row says", () => {
  it("counts reports about the account, open ones separately, and its school and email", async () => {
    const [row] = (await listUsers({ search: `RP_${run}` })).rows;
    expect(row).toMatchObject({
      id: special.reported,
      handle: `rp_${run}`,
      displayName: `${run} reported`,
      email: `${special.reported}@${TEST_SCHOOL}`,
      schoolDomain: TEST_SCHOOL,
      role: "student",
      accountStatus: "active",
      isAdmin: false,
      listings: 0,
      reportsAgainst: 2,
      openReportsAgainst: 1,
    });
    expect(row.createdAt).toBeInstanceOf(Date);
  });

  it("gives zeros for an account nobody reported and that has no listings", async () => {
    const [row] = (await listUsers({ search: `${run} 100 sure` })).rows;
    expect(row).toMatchObject({ id: special.plain, listings: 0, reportsAgainst: 0, openReportsAgainst: 0 });
  });

  it("never carries a message, password, session or address of a device", async () => {
    const [row] = (await listUsers({ search: `RP_${run}` })).rows;
    expect(Object.keys(row).sort()).toEqual(
      ["accountStatus", "createdAt", "displayName", "email", "handle", "id", "isAdmin", "listings", "openReportsAgainst", "reportsAgainst", "role", "schoolDomain", "schoolName"].sort(),
    );
  });
});
