import { and, asc, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { partner, perk, perkVoucher } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { PerkKind } from "@/lib/perks/kinds";

export type PerkItem = {
  id: string;
  title: string;
  terms: string;
  limitPerStudent: number | null;
  limitPeriod: string | null;
  endsAt: Date | null;
  partnerName: string;
  kind: string;
  area: string;
  /** The shop has a PIN, so a student can claim. The PIN itself is never selected. */
  claimable: boolean;
  totalQuantity: number | null;
  /** Vouchers still available, or null when there is no total quantity. */
  left: number | null;
};

/**
 * Perks a student of `schoolDomain` can see now: live, started, not ended, from
 * an active partner that serves their school (no school list means every school).
 * Partners' contact details are never selected.
 */
export function visiblePerks(schoolDomain: string | null) {
  return and(
    eq(perk.status, "live"),
    eq(partner.status, "active"),
    lte(perk.startsAt, sql`now()`),
    or(isNull(perk.endsAt), gt(perk.endsAt, sql`now()`)),
    or(isNull(partner.schoolDomains), sql`${schoolDomain}::text = any(${partner.schoolDomains})`),
  );
}

/** Visible perks, newest first, optionally narrowed to one kind and one area. */
export async function listPerks(
  schoolDomain: string | null,
  filter: { kind?: PerkKind; area?: string } = {},
): Promise<PerkItem[]> {
  return getDb()
    .select({
      id: perk.id,
      title: perk.title,
      terms: perk.terms,
      limitPerStudent: perk.limitPerStudent,
      limitPeriod: perk.limitPeriod,
      endsAt: perk.endsAt,
      partnerName: partner.name,
      kind: partner.kind,
      area: partner.area,
      claimable: sql<boolean>`${partner.pin} is not null`,
      totalQuantity: perk.totalQuantity,
      left: sql<number | null>`case when ${perk.totalQuantity} is null then null else greatest(${perk.totalQuantity} - (select count(*) from ${perkVoucher} where ${perkVoucher.perkId} = ${perk.id} and (${perkVoucher.status} = 'redeemed' or (${perkVoucher.status} = 'claimed' and ${perkVoucher.expiresAt} > now()))), 0)::int end`,
    })
    .from(perk)
    .innerJoin(partner, eq(partner.id, perk.partnerId))
    .where(
      and(
        visiblePerks(schoolDomain),
        filter.kind ? eq(partner.kind, filter.kind) : undefined,
        filter.area ? eq(partner.area, filter.area) : undefined,
      ),
    )
    .orderBy(desc(perk.startsAt), desc(perk.id));
}

/** Whether the student's school has at least one visible perk; a one-row check for the tab bar. */
export async function hasVisiblePerks(schoolDomain: string | null): Promise<boolean> {
  const rows = await getDb()
    .select({ id: perk.id })
    .from(perk)
    .innerJoin(partner, eq(partner.id, perk.partnerId))
    .where(visiblePerks(schoolDomain))
    .limit(1);
  return rows.length > 0;
}

/** The kinds and areas the student's visible perks cover, for the filter chips. */
export async function perkFilterOptions(schoolDomain: string | null): Promise<{ kinds: string[]; areas: string[] }> {
  const rows = await getDb()
    .selectDistinct({ kind: partner.kind, area: partner.area })
    .from(perk)
    .innerJoin(partner, eq(partner.id, perk.partnerId))
    .where(visiblePerks(schoolDomain))
    .orderBy(asc(partner.area), asc(partner.kind));
  return {
    kinds: [...new Set(rows.map((r) => r.kind))],
    areas: [...new Set(rows.map((r) => r.area))],
  };
}
