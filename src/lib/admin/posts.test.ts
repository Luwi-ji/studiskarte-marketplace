import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { image, post, report } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";
import { listAdminPosts, parseStatus, POSTS_PAGE_SIZE } from "./posts";

vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const alice = `ap-a-${run}`;
const bob = `ap-b-${run}`;
const reporters = [1, 2, 3].map((n) => `ap-r${n}-${run}`);
const people = [alice, bob, ...reporters];
const aliceHandle = `pta_${run}`;
const bobHandle = `ptb_${run}`;
const BULK = 26;
const DAY = 86_400_000;

const ids: Record<string, string> = {};

/** A real post made the way a member makes one, by `ownerId`. */
async function newPost(ownerId: string, title: string): Promise<string> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title,
    description: "A post for the admin list.",
    categoryId: "other",
    condition: null,
    priceKind: "free",
    priceAmount: "",
    paymentCash: false,
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

/** A bare row, for the many posts that only need a title, an owner, a status and a date. */
function row(ownerId: string, title: string, status: string, createdAt: Date) {
  return {
    exchangeDelivery: false,
    ownerId,
    kind: "showcase",
    title,
    description: "A post for the admin list.",
    categoryId: "other",
    priceKind: "free",
    exchangeMeetup: true,
    meetupLocation: "Main gate",
    status,
    createdAt,
  };
}

beforeAll(async () => {
  await createTestStudent(alice, { handle: aliceHandle, name: `${run} Alpha Person` });
  await createTestStudent(bob, { handle: bobHandle, name: `${run} Bravo Person` });
  for (const r of reporters) await createTestStudent(r);

  const bulk = Array.from({ length: BULK }, (_, i) => row(bob, `${run} bulk ${String(i).padStart(2, "0")}`, "withdrawn", new Date(Date.UTC(2001, 0, 1) + i * 60_000)));
  await db.insert(post).values(bulk);

  const recent = Date.now() - DAY;
  const [pct, plain, under, other] = await db
    .insert(post)
    .values([
      row(alice, `${run} 100% cotton`, "expired", new Date(recent)),
      row(alice, `${run} 100 cotton`, "expired", new Date(recent)),
      row(alice, `${run} a_b`, "expired", new Date(recent)),
      row(alice, `${run} axb`, "expired", new Date(recent)),
    ])
    .returning({ id: post.id });
  Object.assign(ids, { pct: pct.id, plain: plain.id, under: under.id, other: other.id });

  ids.calculus = await newPost(alice, `${run} Calculus textbook`);
  ids.reported = await newPost(alice, `${run} Reported lamp`);

  const base = { postId: ids.reported, reason: "spam" };
  await db.insert(report).values([
    { ...base, reporterId: reporters[0], status: "open" },
    { ...base, reporterId: reporters[1], status: "open" },
    { ...base, reporterId: reporters[2], status: "dismissed", handledBy: reporters[2], handledAt: new Date() },
  ]);
}, 240_000);

afterAll(async () => {
  await db.delete(report).where(inArray(report.reporterId, people));
  await db.delete(post).where(inArray(post.ownerId, people));
  await db.delete(image).where(inArray(image.ownerId, people));
  for (const who of people) await deleteTestStudent(who);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
}, 120_000);

const idsOf = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("parseStatus", () => {
  it("accepts a real status and treats anything else as all", () => {
    expect(parseStatus("hidden")).toBe("hidden");
    expect(parseStatus(["removed", "open"])).toBe("removed");
    expect(parseStatus("bogus")).toBe("all");
    expect(parseStatus(undefined)).toBe("all");
  });
});

describe("listAdminPosts", () => {
  it("finds a post by part of its title, whatever the case", async () => {
    const result = await listAdminPosts({ search: `${run} CALCULUS` });
    expect(result.rows.map((r) => r.id)).toEqual([ids.calculus]);
    expect(result.rows[0]).toMatchObject({ title: `${run} Calculus textbook`, kind: "showcase", status: "open", ownerHandle: aliceHandle, ownerName: `${run} Alpha Person`, openReportCount: 0 });
  });

  it("finds posts by the owner's handle (with or without @) or display name", async () => {
    const byHandle = await listAdminPosts({ search: `@${aliceHandle}` });
    expect(byHandle.total).toBe(6);
    expect(byHandle.rows.every((r) => r.ownerHandle === aliceHandle)).toBe(true);
    expect(idsOf((await listAdminPosts({ search: bobHandle, status: "all" })).rows)).toHaveLength(POSTS_PAGE_SIZE);
    expect((await listAdminPosts({ search: `${run} Alpha` })).total).toBe(6);
    expect((await listAdminPosts({ search: `${run} Bravo` })).total).toBe(BULK);
  });

  it("filters by status, and all or an unknown status filters nothing", async () => {
    expect((await listAdminPosts({ search: run, status: "expired" })).total).toBe(4);
    expect((await listAdminPosts({ search: run, status: "withdrawn" })).total).toBe(BULK);
    expect((await listAdminPosts({ search: run, status: "open" })).total).toBe(2);
    expect((await listAdminPosts({ search: run, status: "removed" })).total).toBe(0);
    expect((await listAdminPosts({ search: run, status: "all" })).total).toBe(BULK + 6);
    expect((await listAdminPosts({ search: run, status: "bogus" })).status).toBe("all");
  });

  it("gives 25 per page, newest first, and the rest on the last page", async () => {
    expect(POSTS_PAGE_SIZE).toBe(25);
    const first = await listAdminPosts({ search: run, status: "withdrawn", page: 1 });
    expect(first).toMatchObject({ total: BULK, totalPages: 2, page: 1 });
    expect(first.rows).toHaveLength(25);
    const times = first.rows.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    const second = await listAdminPosts({ search: run, status: "withdrawn", page: 2 });
    expect(second.rows).toHaveLength(BULK - 25);
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(BULK);

    const everything = await listAdminPosts({ search: run, page: 1 });
    expect(everything.rows.slice(0, 6).every((r) => r.createdAt.getFullYear() > 2001)).toBe(true);
    const beyond = await listAdminPosts({ search: run, status: "withdrawn", page: 99 });
    expect(beyond.page).toBe(2);
    expect(await listAdminPosts({ search: `${run}-nothing-has-this`, page: 5 })).toMatchObject({ total: 0, totalPages: 1, page: 1, rows: [] });
  });

  it("treats % and _ in the search as themselves", async () => {
    expect(idsOf((await listAdminPosts({ search: `${run} 100%` })).rows)).toEqual([ids.pct]);
    expect(idsOf((await listAdminPosts({ search: `${run} a_b` })).rows)).toEqual([ids.under]);
    expect((await listAdminPosts({ search: `${run} a_b` })).rows.some((r) => r.id === ids.other)).toBe(false);
  });

  it("counts only open reports", async () => {
    const result = await listAdminPosts({ search: `${run} Reported lamp` });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ id: ids.reported, openReportCount: 2 });
  });
});
