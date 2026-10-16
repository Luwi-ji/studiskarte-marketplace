import { and, eq, gte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { post, student } from "@/db/schema";
import { CONDITIONS, PRICE_MAX } from "@/lib/posts/schema";

export const SORTS = ["newest", "price_low", "price_high"] as const;
export type Sort = (typeof SORTS)[number];

export const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest first",
  price_low: "Price: low to high",
  price_high: "Price: high to low",
};

export const LISTED = ["day", "week", "month"] as const;
export type Listed = (typeof LISTED)[number];

export const LISTED_LABEL: Record<Listed, string> = {
  day: "Last 24 hours",
  week: "Last 7 days",
  month: "Last 30 days",
};

const LISTED_INTERVAL: Record<Listed, string> = { day: "1 day", week: "7 days", month: "30 days" };

const QUERY_MAX = 100;
const TERMS_MAX = 5;
const TERM_MIN = 2;

export type Filters = {
  school?: string;
  category?: string;
  kind?: "showcase" | "wishlist";
  condition?: (typeof CONDITIONS)[number];
  /** Whole pesos. A post with no price (negotiable) never matches a price bound; free counts as ₱0. */
  priceMin?: number;
  priceMax?: number;
  listed?: Listed;
  sort: Sort;
  /** What the student typed, tidied. Empty or absent means no search. */
  query?: string;
  /** The words searched for, each at least 2 letters. Empty with a query means nothing can match. */
  terms: string[];
};

export const DEFAULT_FILTERS: Filters = { sort: "newest", terms: [] };

// An unreadable value is ignored, so a mistyped link still opens the feed.
const slug = z.string().regex(/^[a-z0-9._-]{1,60}$/).optional().catch(undefined);
const peso = z.string().regex(/^\d{1,7}$/).transform(Number).pipe(z.number().max(PRICE_MAX)).optional().catch(undefined);

const paramsSchema = z.object({
  school: slug,
  category: slug,
  kind: z.enum(["showcase", "wishlist"]).optional().catch(undefined),
  condition: z.enum(CONDITIONS).optional().catch(undefined),
  min: peso,
  max: peso,
  listed: z.enum(LISTED).optional().catch(undefined),
  sort: z.enum(SORTS).catch("newest"),
  q: z.string().optional().catch(undefined),
});

/** The raw query-string values of a page, as Next gives them. */
export type RawParams = Record<string, string | string[] | undefined>;

/** A repeated parameter counts as its first value; an empty one as absent. */
export function firstValues(raw: RawParams): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const one = Array.isArray(value) ? value[0] : value;
    if (one) values[key] = one;
  }
  return values;
}

/** Reads filters, sort and search words from a page's query string. Anything unreadable is ignored. */
export function parseFilters(raw: RawParams): Filters {
  const first = firstValues(raw);
  const p = paramsSchema.parse(first);
  const query = (p.q ?? "").replace(/\s+/g, " ").trim().slice(0, QUERY_MAX);
  const terms = [...new Set(query.toLowerCase().split(" "))].filter((term) => term.length >= TERM_MIN).slice(0, TERMS_MAX);
  const [priceMin, priceMax] =
    p.min !== undefined && p.max !== undefined && p.min > p.max ? [p.max, p.min] : [p.min, p.max];
  return {
    school: p.school,
    category: p.category,
    kind: p.kind,
    condition: p.condition,
    priceMin,
    priceMax,
    listed: p.listed,
    sort: p.sort,
    query: query || undefined,
    terms,
  };
}

/** How many filters (not the sort, not the search words) are switched on. */
export function activeFilterCount(f: Filters): number {
  return [f.school, f.category, f.kind, f.condition, f.priceMin, f.priceMax, f.listed].filter((v) => v !== undefined).length;
}

/**
 * The post's price in whole pesos for comparing and sorting: free is 0, a
 * negotiable post has none (null).
 */
export const priceKey = sql<number | null>`(case when ${post.priceKind} = 'free' then 0 when ${post.priceKind} = 'amount' then ${post.priceAmount} end)`;

/** Escapes typed text for LIKE, so "100%" or "a_b" mean what they say. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * The conditions a post must meet, all together. Every selected filter must
 * match, and every searched word must be found in the title or description
 * (partly, or close to it, so "calculater" finds "calculator").
 */
export function filterConditions(f: Filters): SQL[] {
  const conditions: SQL[] = [];
  if (f.school) conditions.push(eq(student.schoolDomain, f.school));
  if (f.category) conditions.push(eq(post.categoryId, f.category));
  if (f.kind) conditions.push(eq(post.kind, f.kind));
  if (f.condition) conditions.push(eq(post.condition, f.condition));
  if (f.priceMin !== undefined) conditions.push(sql`${priceKey} >= ${f.priceMin}`);
  if (f.priceMax !== undefined) conditions.push(sql`${priceKey} <= ${f.priceMax}`);
  if (f.listed) conditions.push(gte(post.listedAt, sql`now() - ${LISTED_INTERVAL[f.listed]}::interval`));
  if (f.query) {
    if (f.terms.length === 0) conditions.push(sql`false`);
    for (const term of f.terms) {
      const like = `%${escapeLike(term)}%`;
      conditions.push(
        or(sql`${post.title} ilike ${like}`, sql`${post.description} ilike ${like}`, sql`${term} <% ${post.title}`) as SQL,
      );
    }
  }
  return conditions;
}

/** The conditions as one, or undefined when none apply. */
export function allFilterConditions(f: Filters): SQL | undefined {
  return and(...filterConditions(f));
}

/** The query string for a set of values, leaving out empty ones. */
export function toSearchParams(values: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return params.toString();
}
