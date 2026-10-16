import { and, count, desc, eq, sql } from "drizzle-orm";
import { image, post, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { escapeLike } from "@/lib/discovery/filters";
import { visibleToOthers } from "@/lib/discovery/visibility";

export type PersonResult = {
  handle: string;
  displayName: string;
  school: string;
  avatarThumbKey: string | null;
};

export type SchoolResult = { domain: string; name: string; listings: number };

const PEOPLE_MAX = 30;

/**
 * People whose handle or display name contains what was typed, or is close to
 * it (so a misspelled handle still finds them). Best matches first. Only active
 * students who finished sign-up; never anyone suspended or deleted. Never
 * selects an email.
 */
export async function searchPeople(rawQuery: string): Promise<PersonResult[]> {
  const text = rawQuery.replace(/\s+/g, " ").trim().slice(0, 100).toLowerCase();
  if (text.replace("@", "").length < 2) return [];
  const needle = text.replace(/^@/, "");
  const like = `%${escapeLike(needle)}%`;
  const closeness = sql`greatest(similarity(${student.handle}, ${needle}), similarity(lower(${student.name}), ${needle}))`;

  const rows = await getDb()
    .select({
      handle: student.handle,
      displayName: student.name,
      schoolName: school.name,
      schoolDomain: school.domain,
      avatarThumbKey: image.thumbKey,
    })
    .from(student)
    .innerJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(
      and(
        eq(student.accountStatus, "active"),
        sql`${student.handle} is not null`,
        sql`(${student.handle} ilike ${like} or ${student.name} ilike ${like} or ${student.handle} % ${needle} or lower(${student.name}) % ${needle})`,
      ),
    )
    .orderBy(
      // An exact handle first, then a handle that starts with it, then the closest.
      sql`(${student.handle} = ${needle}) desc`,
      sql`(${student.handle} like ${`${escapeLike(needle)}%`}) desc`,
      desc(closeness),
      student.handle,
    )
    .limit(PEOPLE_MAX);

  return rows.flatMap((row) =>
    row.handle
      ? [{ handle: row.handle, displayName: row.displayName, school: row.schoolName ?? row.schoolDomain, avatarThumbKey: row.avatarThumbKey }]
      : [],
  );
}

/** How many posts each school has that other students can see. */
async function listingCounts(): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ domain: student.schoolDomain, n: count() })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .where(visibleToOthers())
    .groupBy(student.schoolDomain);
  return new Map(rows.map((row) => [row.domain, row.n]));
}

/**
 * Schools whose name or domain contains what was typed (or is close to it),
 * with how many posts they have right now. Only schools that have an active
 * student.
 */
export async function searchSchools(rawQuery: string): Promise<SchoolResult[]> {
  const needle = rawQuery.replace(/\s+/g, " ").trim().slice(0, 100).toLowerCase();
  if (needle.length < 2) return [];
  const like = `%${escapeLike(needle)}%`;
  const [rows, counts] = await Promise.all([
    getDb()
      .select({ domain: school.domain, name: school.name })
      .from(school)
      .where(
        and(
          sql`(${school.name} ilike ${like} or ${school.domain} ilike ${like} or lower(${school.name}) % ${needle})`,
          sql`exists (select 1 from ${student} where ${student.schoolDomain} = ${school.domain} and ${student.accountStatus} = 'active')`,
        ),
      )
      .orderBy(school.name, school.domain)
      .limit(20),
    listingCounts(),
  ]);
  return rows.map((row) => ({ domain: row.domain, name: row.name ?? row.domain, listings: counts.get(row.domain) ?? 0 }));
}

/** Schools that have posts right now, for the filter list, by name. */
export async function listSchoolsWithPosts(): Promise<{ domain: string; name: string }[]> {
  const counts = await listingCounts();
  if (counts.size === 0) return [];
  const rows = await getDb().select({ domain: school.domain, name: school.name }).from(school);
  return rows
    .filter((row) => counts.has(row.domain))
    .map((row) => ({ domain: row.domain, name: row.name ?? row.domain }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
