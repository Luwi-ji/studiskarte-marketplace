import { and, desc, eq, inArray } from "drizzle-orm";
import { partner, perk, perkVoucher } from "@/db/schema";
import { conversionOf, voucherCounts } from "@/lib/admin/perks";
import { getDb } from "@/lib/db";

export const REPORT_TOKEN = /^[A-Za-z0-9_-]{32}$/;

export type PartnerReport = {
  partnerName: string;
  perks: { title: string; status: string; claimed: number; redeemed: number; expired: number; conversion: number | null }[];
  recent: { redeemedAt: Date; code: string; perkTitle: string }[];
};

/**
 * What a shop sees at its private link: its perks' numbers and its latest redemptions (time and voucher code). Never a
 * student's id, handle or name, and never the PIN. A token of the wrong shape is refused before any query.
 */
export async function getPartnerReport(token: string): Promise<PartnerReport | null> {
  if (!REPORT_TOKEN.test(token)) return null;
  const db = getDb();
  const [owner] = await db.select({ id: partner.id, name: partner.name }).from(partner).where(eq(partner.reportToken, token));
  if (!owner) return null;

  const perks = await db.select({ id: perk.id, title: perk.title, status: perk.status }).from(perk).where(eq(perk.partnerId, owner.id)).orderBy(desc(perk.createdAt));
  if (perks.length === 0) return { partnerName: owner.name, perks: [], recent: [] };
  const ids = perks.map((p) => p.id);

  const counts = await db.select({ perkId: perkVoucher.perkId, ...voucherCounts }).from(perkVoucher).where(inArray(perkVoucher.perkId, ids)).groupBy(perkVoucher.perkId);
  const byPerk = new Map(counts.map((c) => [c.perkId, c]));
  const recent = await db
    .select({ redeemedAt: perkVoucher.redeemedAt, code: perkVoucher.code, perkTitle: perk.title })
    .from(perkVoucher)
    .innerJoin(perk, eq(perk.id, perkVoucher.perkId))
    .where(and(inArray(perkVoucher.perkId, ids), eq(perkVoucher.status, "redeemed")))
    .orderBy(desc(perkVoucher.redeemedAt))
    .limit(50);

  return {
    partnerName: owner.name,
    perks: perks.map((p) => {
      const c = byPerk.get(p.id) ?? { claimed: 0, redeemed: 0, expired: 0 };
      return { title: p.title, status: p.status, claimed: c.claimed, redeemed: c.redeemed, expired: c.expired, conversion: conversionOf(c.claimed, c.redeemed) };
    }),
    recent: recent.flatMap((r) => (r.redeemedAt ? [{ redeemedAt: r.redeemedAt, code: r.code, perkTitle: r.perkTitle }] : [])),
  };
}
