import { and, asc, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { partner, perk } from "@/db/schema";
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
};

/**
 * Perks a student of `schoolDomain` can see now: live, started, not ended, from
 * an active partner that serves their school (no school list means every school).
 * Partners' contact details are never selected.
 */
function visiblePerks(schoolDomain: string) {
  return and(
    eq(perk.status, "live"),
    eq(partner.status, "active"),
    lte(perk.startsAt, sql`now()`),
    or(isNull(perk.endsAt), gt(perk.endsAt, sql`now()`)),
    or(isNull(partner.schoolDomains), sql`${schoolDomain} = any(${partner.schoolDomains})`),
  );
}

/** Visible perks, newest first, optionally narrowed to one kind and one area. */
export async function listPerks(
  schoolDomain: string,
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

/** The kinds and areas the student's visible perks cover, for the filter chips. */
export async function perkFilterOptions(schoolDomain: string): Promise<{ kinds: string[]; areas: string[] }> {
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
