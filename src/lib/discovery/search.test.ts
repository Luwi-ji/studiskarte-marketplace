import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { image, post, school } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { listFeed } from "@/lib/discovery/feed";
import { parseFilters } from "@/lib/discovery/filters";
import { listSchoolsWithPosts, searchPeople, searchSchools } from "@/lib/discovery/search";
import { createPost } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { followStudent } from "@/lib/social/follow";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
// Everything lives in a school of its own, so a school filter returns exactly these posts.
const domain = `s${run}.edu.ph`;
const other = `o${run}.edu.ph`;
const tag = `zq${run}`; // a word only this run's titles contain
const viewer = `se-v-${run}`;
const starA = `se-a-${run}`; // followed by the viewer
const starB = `se-b-${run}`;
const elsewhere = `se-e-${run}`; // at another school
const suspended = `se-s-${run}`;
const unfinished = `se-u-${run}`; // never chose a handle
const students = [viewer, starA, starB, elsewhere, suspended, unfinished];

type Spec = {
  owner: string;
  title: string;
  description?: string;
  kind?: "showcase" | "wishlist";
  categoryId?: string;
  condition?: NewPostInput["condition"];
  price: number | "free" | "negotiable";
  ageDays: number;
};

async function make(spec: Spec): Promise<string> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId: spec.owner, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: spec.kind ?? "showcase",
    title: spec.title,
    description: spec.description ?? "A test post.",
    categoryId: spec.categoryId ?? "other",
    condition: spec.condition ?? null,
    priceKind: spec.price === "free" ? "free" : spec.price === "negotiable" ? "negotiable" : "amount",
    priceAmount: typeof spec.price === "number" ? String(spec.price) : "",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    deliveryArea: "",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId: spec.owner, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  await db
    .update(post)
    .set({ listedAt: sql`now() - ${spec.ageDays} * interval '1 day'`, expiresAt: sql`now() + interval '20 days'` })
    .where(eq(post.id, result.id));
  return result.id;
}

const ids: Record<string, string> = {};
const scope = { school: domain };
const feed = async (params: Record<string, string> = {}, viewerId = viewer, limit = 200) =>
  (await listFeed(viewerId, { filters: parseFilters({ ...scope, ...params }), limit })).items.map((i) => i.id);
const names = (found: string[]) => found.map((id) => Object.keys(ids).find((k) => ids[k] === id));

beforeAll(async () => {
  await createTestStudent(viewer, { handle: `vw_${run}`, schoolDomain: domain });
  await createTestStudent(starA, { handle: `alice_${run}`, name: "Alice Reyes", schoolDomain: domain });
  await createTestStudent(starB, { handle: `bruno_${run}`, name: "Bruno Santos", schoolDomain: domain });
  await createTestStudent(elsewhere, { handle: `else_${run}`, schoolDomain: other });
  await createTestStudent(suspended, { handle: `susp_${run}`, name: "Suspended Sam", schoolDomain: domain, accountStatus: "suspended" });
  await createTestStudent(unfinished, { name: "Unfinished Una", schoolDomain: domain });
  await db.update(school).set({ name: `Zeta Polytechnic ${run}` }).where(eq(school.domain, domain));
  await followStudent(viewer, starA);

  ids.calc = await make({ owner: starA, title: `Casio calculator ${tag}`, categoryId: "electronics", condition: "used_good", price: 500, ageDays: 1 });
  ids.laptop = await make({ owner: starA, title: `Laptop ${tag}`, categoryId: "electronics", condition: "used_good", price: "negotiable", ageDays: 20 });
  ids.book = await make({
    owner: starB,
    title: `Calculus textbook ${tag}`,
    description: "100% original, a_b edition",
    categoryId: "textbooks",
    condition: "used_fair",
    price: 300,
    ageDays: 10,
  });
  ids.notes = await make({ owner: starB, title: `Notes bundle ${tag}`, kind: "wishlist", categoryId: "textbooks", condition: "used_good", price: "free", ageDays: 3 });
  ids.tutor = await make({ owner: starB, title: `Tutoring ${tag}`, categoryId: "services", price: 200, ageDays: 29 });
  // Same price and the same moment: only the id can order these two.
  ids.twinA = await make({ owner: starB, title: `Twin A ${tag}`, price: 500, ageDays: 5 });
  ids.twinB = await make({ owner: starB, title: `Twin B ${tag}`, price: 500, ageDays: 5 });
  await db.update(post).set({ listedAt: sql`(select listed_at from post where id = ${ids.twinA})` }).where(eq(post.id, ids.twinB));
  ids.gone = await make({ owner: starB, title: `Withdrawn ${tag}`, price: 100, ageDays: 1 });
  await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, ids.gone));
  ids.hidden = await make({ owner: suspended, title: `By suspended ${tag}`, price: 100, ageDays: 1 });
  ids.faraway = await make({ owner: elsewhere, title: `Other school ${tag}`, price: 100, ageDays: 1 });
}, 180_000);

afterAll(async () => {
  await db.delete(post).where(inArray(post.ownerId, students));
  await db.delete(image).where(inArray(image.ownerId, students));
  for (const id of students) await deleteTestStudent(id);
  await db.delete(school).where(inArray(school.domain, [domain, other]));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("filters", () => {
  it("shows only the chosen school, and never a withdrawn post or a suspended student's", async () => {
    const found = names(await feed());
    expect(found).not.toContain("gone");
    expect(found).not.toContain("hidden");
    expect(found).not.toContain("faraway");
    expect(names(await feed({ school: other }))).toEqual(["faraway"]);
  });

  it("combines every chosen filter: a post must match all of them", async () => {
    expect(names(await feed({ category: "textbooks" })).sort()).toEqual(["book", "notes"]);
    expect(names(await feed({ category: "textbooks", kind: "wishlist" }))).toEqual(["notes"]);
    expect(names(await feed({ category: "textbooks", kind: "wishlist", condition: "used_fair" }))).toEqual([]);
    expect(names(await feed({ category: "electronics", condition: "used_good", min: "400", listed: "week" }))).toEqual(["calc"]);
    expect(names(await feed({ category: "electronics", condition: "used_good", min: "600" }))).toEqual([]);
  });

  it("matches any of several categories, conditions or schools, and still needs every kind of filter to match", async () => {
    expect(names(await feed({ category: "textbooks,services" })).sort()).toEqual(["book", "notes", "tutor"]);
    expect(names(await feed({ category: "electronics,services", condition: "used_good" })).sort()).toEqual(["calc", "laptop"]);
    expect(names(await feed({ condition: "used_fair,new" }))).toEqual(["book"]);
    expect(names(await feed({ school: `${domain},${other}` }))).toEqual(expect.arrayContaining(["calc", "faraway"]));
    expect(names(await feed({ school: other, category: "textbooks,services" }))).toEqual([]);
  });

  it("filters by price: free counts as 0, negotiable matches no price bound", async () => {
    expect(names(await feed({ max: "300" })).sort()).toEqual(["book", "notes", "tutor"]);
    expect(names(await feed({ min: "1", max: "300" })).sort()).toEqual(["book", "tutor"]);
    expect(names(await feed({ min: "300", max: "500" })).sort()).toEqual(["book", "calc", "twinA", "twinB"]);
    expect(names(await feed({ min: "0" }))).not.toContain("laptop");
    expect(names(await feed())).toContain("laptop");
  });

  it("filters by when it was listed", async () => {
    expect(names(await feed({ listed: "day" }))).toEqual([]);
    expect(names(await feed({ listed: "week" })).sort()).toEqual(["calc", "notes", "twinA", "twinB"]);
    expect(names(await feed({ listed: "month" }))).toEqual(expect.arrayContaining(["tutor", "laptop", "book"]));
    expect(names(await feed({ listed: "week" }))).not.toContain("book");
  });
});

describe("sort and pages", () => {
  const order = async (sort: string) => names(await feed({ sort }));

  it("sorts by price, with no-price posts last either way and ties by newest then id", async () => {
    const low = await order("price_low");
    expect(low.slice(0, 3)).toEqual(["notes", "tutor", "book"]);
    expect(low.at(-1)).toBe("laptop");
    const high = await order("price_high");
    expect(high.slice(-3)).toEqual(["tutor", "notes", "laptop"]);
    expect(new Set(high.slice(0, 3))).toEqual(new Set(["calc", "twinA", "twinB"]));
  });

  it.each(["newest", "price_low", "price_high"])("pages through %s one post at a time without a repeat or a gap", async (sort) => {
    const whole = await feed({ sort });
    for (const size of [1, 2]) {
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let guard = 0; guard < 50; guard++) {
        const page = await listFeed(viewer, { filters: parseFilters({ ...scope, sort }), cursor, limit: size });
        seen.push(...page.items.map((i) => i.id));
        cursor = page.nextCursor;
        if (!cursor) break;
      }
      expect(seen).toEqual(whole);
    }
  });

  it("puts followed students first only for the default sort without a search", async () => {
    // laptop is the followed student's, and 20 days old; notes is another student's, 3 days old.
    const before = (list: (string | undefined)[], first: string, second: string) => list.indexOf(first) < list.indexOf(second);
    expect(before(names(await feed()), "laptop", "notes")).toBe(true);
    // Filters alone keep the follow order.
    expect(before(names(await feed({ listed: "month" })), "laptop", "notes")).toBe(true);
    // A price sort ignores it: book (300, not followed) comes before calc (500, followed).
    expect(before(names(await feed({ sort: "price_low" })), "book", "calc")).toBe(true);
    // Searching ignores it too: newest first.
    expect(before(names(await feed({ q: tag })), "notes", "laptop")).toBe(true);
  });
});

describe("search posts", () => {
  const find = async (q: string, extra: Record<string, string> = {}) => names(await feed({ q, ...extra }));

  it("finds part of a word, in the title or the description", async () => {
    expect(await find(`calc ${tag}`)).toEqual(expect.arrayContaining(["calc", "book"]));
    expect(await find(`ORIGINAL ${tag}`)).toEqual(["book"]);
  });

  it("finds a misspelled word", async () => {
    expect(await find(`calculater ${tag}`)).toContain("calc");
    expect(await find(`textbok ${tag}`)).toContain("book");
  });

  it("needs every word, and nothing matches a single letter or a word that is not there", async () => {
    expect(await find(`calculator textbook ${tag}`)).toEqual([]);
    expect(await find("a")).toEqual([]);
    expect(await find(`zzzzqqqq ${tag}`)).toEqual([]);
  });

  it("treats % and _ as ordinary characters", async () => {
    expect(await find("100%")).toEqual(["book"]);
    expect(await find("a_b")).toEqual(["book"]);
    expect(await find("%")).toEqual([]);
    expect(await find("_")).toEqual([]);
  });

  it("applies the filters to the search too", async () => {
    expect(await find(tag, { category: "services" })).toEqual(["tutor"]);
    expect(await find(`calc ${tag}`, { category: "textbooks" })).toEqual(["book"]);
  });

  it("never finds a withdrawn post or one by a suspended student", async () => {
    const found = await find(tag, { school: domain });
    expect(found).not.toContain("gone");
    expect(found).not.toContain("hidden");
    // Across all schools: other schools' posts show, hidden ones still do not.
    const everywhere = names((await listFeed(viewer, { filters: parseFilters({ q: tag }), limit: 200 })).items.map((i) => i.id));
    expect(everywhere).toContain("faraway");
    expect(everywhere).not.toContain("hidden");
    expect(everywhere).not.toContain("gone");
  });
});

describe("search people", () => {
  it("finds a handle exactly, with an @, in any case, and by display name", async () => {
    // All test handles end in the same run id, so close matches may follow; the exact one comes first.
    expect((await searchPeople(`alice_${run}`))[0].handle).toBe(`alice_${run}`);
    expect((await searchPeople(`@ALICE_${run}`))[0].handle).toBe(`alice_${run}`);
    expect((await searchPeople("Bruno Santos")).map((p) => p.handle)).toContain(`bruno_${run}`);
    expect((await searchPeople("santos")).map((p) => p.handle)).toContain(`bruno_${run}`);
  });

  it("finds a misspelled handle", async () => {
    expect((await searchPeople(`alise_${run}`)).map((p) => p.handle)).toContain(`alice_${run}`);
    expect((await searchPeople(`brunno_${run}`)).map((p) => p.handle)).toContain(`bruno_${run}`);
  });

  it("puts an exact handle before looser matches", async () => {
    const found = (await searchPeople(`alice_${run}`)).map((p) => p.handle);
    expect(found[0]).toBe(`alice_${run}`);
  });

  it("never lists a suspended student or one who has not finished sign-up, and never an email", async () => {
    const all = await searchPeople("susp");
    expect(all.map((p) => p.handle)).not.toContain(`susp_${run}`);
    expect((await searchPeople("Unfinished")).map((p) => p.displayName)).not.toContain("Unfinished Una");
    expect(JSON.stringify(await searchPeople("alice"))).not.toContain("@");
  });

  it("returns nothing for a single letter or only an @", async () => {
    expect(await searchPeople("a")).toEqual([]);
    expect(await searchPeople("@")).toEqual([]);
  });
});

describe("search schools", () => {
  it("finds a school by part of its name or by domain, with its current number of posts", async () => {
    const byName = await searchSchools(`zeta polytech ${run}`);
    // Visible now: calc, laptop, book, notes, tutor, twinA, twinB (not the withdrawn one or the suspended student's).
    expect(byName).toEqual([{ domain, name: `Zeta Polytechnic ${run}`, listings: 7 }]);
    expect((await searchSchools(`s${run}.edu`)).map((s) => s.domain)).toContain(domain);
  });

  it("finds a school despite a misspelling, and lists schools that have posts for the filter", async () => {
    expect((await searchSchools(`zeta polytecnic ${run}`)).map((s) => s.domain)).toContain(domain);
    expect((await listSchoolsWithPosts()).map((s) => s.domain)).toEqual(expect.arrayContaining([domain, other]));
  });

  it("returns nothing for one letter", async () => {
    expect(await searchSchools("z")).toEqual([]);
  });
});
