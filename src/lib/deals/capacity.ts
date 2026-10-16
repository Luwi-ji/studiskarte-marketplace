import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { deal, post } from "@/db/schema";
import type { DbTransaction, Executor } from "@/lib/db";

/** Deals whose units are spoken for: being arranged, or handed over. */
export const TAKEN_STATUSES = ["agreed", "scheduled", "completed"] as const;
/** Deals still to be carried out. */
export const ACTIVE_STATUSES = ["agreed", "scheduled"] as const;
/** A post that frees up again has at least this many days left. */
export const REOPEN_DAYS = 7;

/** Units taken on a post, as SQL, for lists that select it alongside other columns. */
export function unitsTakenSql(postId: PgColumn): SQL<number> {
  return sql<number>`coalesce((select sum(${deal.quantity})::int from ${deal} where ${deal.postId} = ${postId} and ${deal.status} in ('agreed', 'scheduled', 'completed')), 0)`;
}

/** Units taken on a post: the quantities of its agreed, scheduled and completed deals. */
export async function unitsTaken(db: Executor, postId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`coalesce(sum(${deal.quantity})::int, 0)` })
    .from(deal)
    .where(and(eq(deal.postId, postId), inArray(deal.status, [...TAKEN_STATUSES])));
  return row.n;
}

/** Units still free: null when the post is ongoing (no limit). */
export function unitsLeft(quantity: number | null, taken: number): number | null {
  return quantity === null ? null : Math.max(0, quantity - taken);
}

/**
 * Brings a post's status in line with its deals. The caller holds the post's
 * row lock. An open post whose units are all taken becomes Fully reserved; a
 * reserved one with units free again (a reservation cancelled, the quantity
 * raised) becomes Active again, with at least a week left. A post whose time
 * ran out while deals are still active stays reserved instead of expiring. If
 * every unit was handed over and nothing is pending, it is fulfilled. Returns
 * the status the post now has.
 */
export async function syncAvailability(tx: DbTransaction, postId: string, now: Date): Promise<string> {
  const [row] = await tx
    .select({ status: post.status, quantity: post.quantity, expiresAt: post.expiresAt })
    .from(post)
    .where(eq(post.id, postId));
  if (!row || (row.status !== "open" && row.status !== "reserved")) return row?.status ?? "missing";

  const taken = await unitsTaken(tx, postId);
  const [active] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(deal)
    .where(and(eq(deal.postId, postId), inArray(deal.status, [...ACTIVE_STATUSES])));
  const full = row.quantity !== null && taken >= row.quantity;
  const lapsed = row.expiresAt.getTime() <= now.getTime();

  let status: "open" | "reserved" | "fulfilled" = "open";
  if (active.n > 0 && (full || lapsed)) status = "reserved";
  else if (active.n === 0 && full) status = "fulfilled";

  if (status === row.status) return status;
  const reopened = status === "open";
  await tx
    .update(post)
    .set({
      status,
      updatedAt: now,
      ...(reopened ? { expiresAt: sql`greatest(${post.expiresAt}, ${new Date(now.getTime() + REOPEN_DAYS * 24 * 60 * 60 * 1000)}::timestamptz)` } : {}),
    })
    .where(eq(post.id, postId));
  return status;
}
