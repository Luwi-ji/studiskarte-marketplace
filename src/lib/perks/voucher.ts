import { randomInt, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, inArray, lte, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { partner, perk, perkVoucher, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { visiblePerks } from "@/lib/perks/list";
import { consume, countEvents } from "@/lib/rate-limit";

/** How long an unredeemed voucher lasts. A perk with a total quantity holds stock, so its vouchers last a day, to stop a few accounts keeping all of it. */
export const VOUCHER_DAYS = 3;
export const VOUCHER_DAYS_LIMITED = 1;
const DAY_MS = 24 * 60 * 60 * 1000;

/** No 0/O, 1/I/L: the code is read aloud and written on receipts. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Wrong PINs allowed in the window before redeeming locks for that student. */
const PIN_MAX_MISSES = 5;
const PIN_WINDOW_SECONDS = 600;

const PERIODS = ["day", "week", "month"] as const;
const WHEN_WORD: Record<string, string> = { day: "today", week: "this week", month: "this month", ever: "before" };
/** The disabled button text once a student has used a perk's limit. */
export const CLAIMED_LABEL: Record<string, string> = { day: "Claimed today", week: "Claimed this week", month: "Claimed this month", ever: "Already claimed" };

export type Voucher = { id: string; code: string; expiresAt: Date };

/**
 * A voucher that still counts: redeemed, or claimed and not yet expired. Only live vouchers count toward a student's
 * limit, a perk's total quantity and "N left"; an unredeemed voucher that ran out never blocks anyone.
 */
export const liveVoucher: SQL = sql`(${perkVoucher.status} = 'redeemed' or (${perkVoucher.status} = 'claimed' and ${perkVoucher.expiresAt} > now()))`;

export function makeCode(): string {
  let tail = "";
  for (let i = 0; i < 4; i += 1) tail += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `ST-${tail}`;
}

/** Whether `column` falls in the current day, week (Monday start) or month in Philippine time; `ever` and null mean always (no condition). */
export function inPeriod(period: string | null, column: AnyColumn): SQL | undefined {
  if (period === null || period === "ever") return undefined;
  if (!(PERIODS as readonly string[]).includes(period)) return undefined;
  const unit = sql.raw(`'${period}'`);
  return sql`date_trunc(${unit}, ${column} at time zone 'Asia/Manila') = date_trunc(${unit}, now() at time zone 'Asia/Manila')`;
}

/** Claims a perk: makes (or returns the open) voucher for this student, within the perk's per-student limit and total quantity. */
export async function claimPerk(args: { studentId: string; perkId: string }): Promise<{ ok: true; voucher: Voucher } | { ok: false; error: string }> {
  const db = getDb();
  const [me] = await db.select({ domain: student.schoolDomain, status: student.accountStatus }).from(student).where(eq(student.id, args.studentId));
  if (!me || me.status !== "active" || me.domain === null) return { ok: false, error: "Verify your school email to claim perks." };
  if (!(await consume({ action: "perk_claim", key: args.studentId, max: 10, windowSeconds: 3600 }))) return { ok: false, error: "Too many claims. Try again later." };

  const [row] = await db
    .select({ limitPerStudent: perk.limitPerStudent, limitPeriod: perk.limitPeriod, totalQuantity: perk.totalQuantity, endsAt: perk.endsAt, pin: partner.pin })
    .from(perk)
    .innerJoin(partner, eq(partner.id, perk.partnerId))
    .where(and(eq(perk.id, args.perkId), visiblePerks(me.domain)));
  if (!row) return { ok: false, error: "This perk is not available." };
  if (row.pin === null) return { ok: false, error: "This shop is not ready to take claims yet." };

  return db.transaction(async (tx) => {
    // One claim at a time per perk, so the limit and the stock cannot be passed by two claims at once.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${args.perkId}::text))`);
    await tx
      .update(perkVoucher)
      .set({ status: "expired" })
      .where(and(eq(perkVoucher.perkId, args.perkId), eq(perkVoucher.status, "claimed"), lte(perkVoucher.expiresAt, sql`now()`)));

    const [open] = await tx
      .select({ id: perkVoucher.id, code: perkVoucher.code, expiresAt: perkVoucher.expiresAt })
      .from(perkVoucher)
      .where(and(eq(perkVoucher.perkId, args.perkId), eq(perkVoucher.studentId, args.studentId), eq(perkVoucher.status, "claimed")));
    if (open) return { ok: true as const, voucher: open };

    if (row.limitPerStudent !== null) {
      const [{ used }] = await tx
        .select({ used: count() })
        .from(perkVoucher)
        .where(and(eq(perkVoucher.perkId, args.perkId), eq(perkVoucher.studentId, args.studentId), liveVoucher, inPeriod(row.limitPeriod, perkVoucher.claimedAt)));
      if (used >= row.limitPerStudent) return { ok: false as const, error: `You have already claimed this ${WHEN_WORD[row.limitPeriod ?? "ever"] ?? "before"}.` };
    }
    if (row.totalQuantity !== null) {
      const [{ taken }] = await tx.select({ taken: count() }).from(perkVoucher).where(and(eq(perkVoucher.perkId, args.perkId), liveVoucher));
      if (taken >= row.totalQuantity) return { ok: false as const, error: "All claimed. None left." };
    }

    const days = row.totalQuantity !== null ? VOUCHER_DAYS_LIMITED : VOUCHER_DAYS;
    const byAge = Date.now() + days * DAY_MS;
    const expiresAt = new Date(row.endsAt ? Math.min(byAge, row.endsAt.getTime()) : byAge);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const [made] = await tx
        .insert(perkVoucher)
        .values({ perkId: args.perkId, studentId: args.studentId, code: makeCode(), expiresAt })
        .onConflictDoNothing({ target: perkVoucher.code })
        .returning({ id: perkVoucher.id, code: perkVoucher.code, expiresAt: perkVoucher.expiresAt });
      if (made) return { ok: true as const, voucher: made };
    }
    return { ok: false as const, error: "Could not make your voucher. Try again." };
  });
}

/** The cashier typed the shop PIN on the student's phone: marks the voucher redeemed. Only wrong PINs count toward the lock. */
export async function redeemVoucher(args: { studentId: string; voucherId: string; pin: string }): Promise<{ ok: true; redeemedAt: Date } | { ok: false; error: string }> {
  if ((await countEvents("perk_pin", args.studentId, PIN_WINDOW_SECONDS)) >= PIN_MAX_MISSES) {
    return { ok: false, error: "Too many wrong PINs. Wait 10 minutes and ask the cashier to try again." };
  }
  const db = getDb();
  const [row] = await db
    .select({ status: perkVoucher.status, expiresAt: perkVoucher.expiresAt, perkStatus: perk.status, partnerStatus: partner.status, pin: partner.pin })
    .from(perkVoucher)
    .innerJoin(perk, eq(perk.id, perkVoucher.perkId))
    .innerJoin(partner, eq(partner.id, perk.partnerId))
    .where(and(eq(perkVoucher.id, args.voucherId), eq(perkVoucher.studentId, args.studentId)));
  if (!row) return { ok: false, error: "Voucher not found." };
  if (row.status !== "claimed" || row.expiresAt.getTime() <= Date.now()) return { ok: false, error: "This voucher was already used or has expired." };
  if (row.partnerStatus !== "active" || row.perkStatus !== "live") return { ok: false, error: "This perk is paused right now." };
  if (row.pin === null) return { ok: false, error: "This shop is not ready to take claims yet." };

  const given = Buffer.from(args.pin);
  const expected = Buffer.from(row.pin);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    await consume({ action: "perk_pin", key: args.studentId, max: PIN_MAX_MISSES, windowSeconds: PIN_WINDOW_SECONDS });
    return { ok: false, error: "Wrong PIN." };
  }
  const [done] = await db
    .update(perkVoucher)
    .set({ status: "redeemed", redeemedAt: sql`now()` })
    .where(and(eq(perkVoucher.id, args.voucherId), eq(perkVoucher.status, "claimed"), gt(perkVoucher.expiresAt, sql`now()`)))
    .returning({ redeemedAt: perkVoucher.redeemedAt });
  if (!done?.redeemedAt) return { ok: false, error: "This voucher was already used or has expired." };
  return { ok: true, redeemedAt: done.redeemedAt };
}

export type PerkState = { open: Voucher | null; used: number };

/** For the Perks page: each perk's open voucher for this student, and how many live vouchers they have in the perk's current limit period. */
export async function studentPerkState(
  studentId: string,
  perks: { id: string; limitPerStudent: number | null; limitPeriod: string | null }[],
): Promise<Map<string, PerkState>> {
  const state = new Map<string, PerkState>(perks.map((p) => [p.id, { open: null, used: 0 }]));
  if (perks.length === 0) return state;
  const db = getDb();
  const ids = perks.map((p) => p.id);

  const open = await db
    .select({ perkId: perkVoucher.perkId, id: perkVoucher.id, code: perkVoucher.code, expiresAt: perkVoucher.expiresAt })
    .from(perkVoucher)
    .where(and(eq(perkVoucher.studentId, studentId), inArray(perkVoucher.perkId, ids), eq(perkVoucher.status, "claimed"), gt(perkVoucher.expiresAt, sql`now()`)));
  for (const v of open) {
    const entry = state.get(v.perkId);
    if (entry) entry.open = { id: v.id, code: v.code, expiresAt: v.expiresAt };
  }

  // One count per distinct period, for the perks that have a limit.
  const byPeriod = new Map<string, string[]>();
  for (const p of perks) {
    if (p.limitPerStudent === null) continue;
    const key = p.limitPeriod ?? "ever";
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), p.id]);
  }
  for (const [period, periodIds] of byPeriod) {
    const rows = await db
      .select({ perkId: perkVoucher.perkId, n: count() })
      .from(perkVoucher)
      .where(and(eq(perkVoucher.studentId, studentId), inArray(perkVoucher.perkId, periodIds), liveVoucher, inPeriod(period, perkVoucher.claimedAt)))
      .groupBy(perkVoucher.perkId);
    for (const r of rows) {
      const entry = state.get(r.perkId);
      if (entry) entry.used = r.n;
    }
  }
  return state;
}

/** Whether a perk's limit is used up for this student, and the button text to show then. */
export function limitReached(limitPerStudent: number | null, limitPeriod: string | null, used: number): string | null {
  return limitPerStudent !== null && used >= limitPerStudent ? (CLAIMED_LABEL[limitPeriod ?? "ever"] ?? "Already claimed") : null;
}

