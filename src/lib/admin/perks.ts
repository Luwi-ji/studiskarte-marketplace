import { randomBytes, randomInt } from "node:crypto";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { partner, perk, perkVoucher, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { isPerkKind } from "@/lib/perks/kinds";

const NOT_ADMIN = "Only an admin can do this.";
const PERIODS = ["day", "week", "month", "ever"] as const;

export type AdminResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** The admin flag is read from the database here, not trusted from the caller. */
async function isAdmin(adminId: string): Promise<boolean> {
  const [admin] = await getDb().select({ isAdmin: student.isAdmin, status: student.accountStatus }).from(student).where(eq(student.id, adminId));
  return admin?.isAdmin === true && admin.status === "active";
}

export const newPin = (): string => String(randomInt(0, 10000)).padStart(4, "0");
/** 24 random bytes as base64url: exactly 32 characters, the shape the database check wants. */
export const newReportToken = (): string => randomBytes(24).toString("base64url");

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

function text(raw: unknown, label: string, max: number): { ok: true; value: string } | Fail {
  if (typeof raw !== "string") return fail(`Write the ${label} as text.`);
  const value = raw.trim();
  if (value === "" || Array.from(value).length > max) return fail(`${label[0].toUpperCase()}${label.slice(1)} must be 1 to ${max} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(value)) return fail(`${label[0].toUpperCase()}${label.slice(1)} has a character that cannot be used.`);
  return { ok: true, value };
}

function wholeNumber(raw: unknown, label: string, min: number, max: number): { ok: true; value: number | null } | Fail {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return { ok: true, value: null };
  const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return fail(`${label[0].toUpperCase()}${label.slice(1)} must be a whole number from ${min} to ${max}, or empty.`);
  return { ok: true, value: n };
}

/** `YYYY-MM-DD` as the end of that day in Manila (23:59:59 +08:00); empty means no end. Must be in the future. */
export function parseEndsAt(raw: unknown, now = new Date()): { ok: true; value: Date | null } | Fail {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) return { ok: true, value: null };
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return fail("Write the end date as year-month-day, or leave it empty.");
  const date = new Date(`${raw.trim()}T23:59:59+08:00`);
  if (Number.isNaN(date.getTime())) return fail("That end date is not a real date.");
  if (date.getTime() <= now.getTime()) return fail("The end date must be in the future.");
  return { ok: true, value: date };
}

export type PartnerInput = { name: string; kind: string; area: string; schoolDomains: string[] | null; pin: string };
export type PerkInput = { partnerId: string; title: string; terms: string; limitPerStudent: number | null; limitPeriod: string | null; totalQuantity: number | null; endsAt: Date | null };

export function parsePartner(raw: unknown): { ok: true; value: PartnerInput } | Fail {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const name = text(input.name, "name", 120);
  if (!name.ok) return name;
  const area = text(input.area, "area", 120);
  if (!area.ok) return area;
  if (!isPerkKind(input.kind)) return fail("Choose what the shop sells.");
  const domains = Array.isArray(input.schoolDomains) ? input.schoolDomains.filter((d): d is string => typeof d === "string" && d !== "") : [];
  let pin = newPin();
  if (typeof input.pin === "string" && input.pin.trim() !== "") {
    if (!/^\d{4}$/.test(input.pin.trim())) return fail("The PIN is 4 digits, or leave it empty to make one.");
    pin = input.pin.trim();
  }
  return { ok: true, value: { name: name.value, kind: input.kind, area: area.value, schoolDomains: domains.length > 0 ? domains : null, pin } };
}

export function parsePerk(raw: unknown, now = new Date()): { ok: true; value: PerkInput } | Fail {
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  if (typeof input.partnerId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.partnerId)) return fail("Choose a shop.");
  const title = text(input.title, "title", 120);
  if (!title.ok) return title;
  const terms = text(input.terms, "terms", 500);
  if (!terms.ok) return terms;
  const limit = wholeNumber(input.limitPerStudent, "the limit per student", 1, 100);
  if (!limit.ok) return limit;
  let limitPeriod: string | null = null;
  if (limit.value !== null) {
    if (typeof input.limitPeriod !== "string" || !(PERIODS as readonly string[]).includes(input.limitPeriod)) return fail("Choose how often the limit applies: day, week, month or ever.");
    limitPeriod = input.limitPeriod;
  }
  const total = wholeNumber(input.totalQuantity, "the total quantity", 1, 100000);
  if (!total.ok) return total;
  const endsAt = parseEndsAt(input.endsAt, now);
  if (!endsAt.ok) return endsAt;
  return { ok: true, value: { partnerId: input.partnerId, title: title.value, terms: terms.value, limitPerStudent: limit.value, limitPeriod, totalQuantity: total.value, endsAt: endsAt.value } };
}

export type PerkRow = {
  id: string;
  title: string;
  terms: string;
  status: string;
  limitPerStudent: number | null;
  limitPeriod: string | null;
  totalQuantity: number | null;
  endsAt: Date | null;
  claimed: number;
  redeemed: number;
  expired: number;
  /** Redeemed as a percentage of claimed, or null with no claims. */
  conversion: number | null;
};
export type PartnerRow = { id: string; name: string; kind: string; area: string; schoolDomains: string[] | null; status: string; pin: string | null; reportToken: string | null; perks: PerkRow[] };

export const conversionOf = (claimed: number, redeemed: number): number | null => (claimed === 0 ? null : Math.round((100 * redeemed) / claimed));

/** Per perk: every voucher ever made, the redeemed ones, and the ones that ran out unused. */
export const voucherCounts = {
  claimed: sql<number>`count(${perkVoucher.id})::int`,
  redeemed: sql<number>`count(*) filter (where ${perkVoucher.status} = 'redeemed')::int`,
  expired: sql<number>`count(*) filter (where ${perkVoucher.status} = 'expired' or (${perkVoucher.status} = 'claimed' and ${perkVoucher.expiresAt} <= now()))::int`,
};

/** Every partner with its perks and their numbers, newest first. */
export async function listPartnersWithPerks(): Promise<PartnerRow[]> {
  const db = getDb();
  const partners = await db.select().from(partner).orderBy(desc(partner.createdAt));
  if (partners.length === 0) return [];
  const perks = await db.select().from(perk).where(inArray(perk.partnerId, partners.map((p) => p.id))).orderBy(desc(perk.createdAt));
  const counts = perks.length
    ? await db.select({ perkId: perkVoucher.perkId, ...voucherCounts }).from(perkVoucher).where(inArray(perkVoucher.perkId, perks.map((p) => p.id))).groupBy(perkVoucher.perkId)
    : [];
  const byPerk = new Map(counts.map((c) => [c.perkId, c]));
  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    area: p.area,
    schoolDomains: p.schoolDomains,
    status: p.status,
    pin: p.pin,
    reportToken: p.reportToken,
    perks: perks
      .filter((x) => x.partnerId === p.id)
      .map((x) => {
        const c = byPerk.get(x.id) ?? { claimed: 0, redeemed: 0, expired: 0 };
        return {
          id: x.id,
          title: x.title,
          terms: x.terms,
          status: x.status,
          limitPerStudent: x.limitPerStudent,
          limitPeriod: x.limitPeriod,
          totalQuantity: x.totalQuantity,
          endsAt: x.endsAt,
          claimed: c.claimed,
          redeemed: c.redeemed,
          expired: c.expired,
          conversion: conversionOf(c.claimed, c.redeemed),
        };
      }),
  }));
}

export type RedemptionRow = { redeemedAt: Date; handle: string | null; perkTitle: string; partnerName: string; code: string };

/** The latest redemptions. `handle` is null once the account was deleted. */
export async function recentRedemptions(limit = 20): Promise<RedemptionRow[]> {
  const rows = await getDb()
    .select({ redeemedAt: perkVoucher.redeemedAt, handle: student.handle, perkTitle: perk.title, partnerName: partner.name, code: perkVoucher.code })
    .from(perkVoucher)
    .innerJoin(perk, eq(perk.id, perkVoucher.perkId))
    .innerJoin(partner, eq(partner.id, perk.partnerId))
    .innerJoin(student, eq(student.id, perkVoucher.studentId))
    .where(eq(perkVoucher.status, "redeemed"))
    .orderBy(desc(perkVoucher.redeemedAt))
    .limit(limit);
  return rows.flatMap((r) => (r.redeemedAt ? [{ ...r, redeemedAt: r.redeemedAt }] : []));
}

/** The schools a partner may serve, for the form. */
export async function schoolDomainsForForm(): Promise<{ domain: string; name: string }[]> {
  const rows = await getDb().select({ domain: school.domain, name: school.name }).from(school).orderBy(asc(school.domain));
  return rows.map((r) => ({ domain: r.domain, name: r.name ?? r.domain }));
}

export async function createPartner(adminId: string, raw: unknown): Promise<AdminResult<{ pin: string }>> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  const parsed = parsePartner(raw);
  if (!parsed.ok) return parsed;
  const db = getDb();
  const wanted = parsed.value.schoolDomains;
  if (wanted) {
    const known = await db.select({ domain: school.domain }).from(school).where(inArray(school.domain, wanted));
    if (known.length !== new Set(wanted).size) return fail("One of those schools is not known.");
  }
  await db.insert(partner).values({ ...parsed.value, status: "active", reportToken: newReportToken() });
  return { ok: true, pin: parsed.value.pin };
}

export async function createPerk(adminId: string, raw: unknown): Promise<AdminResult> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  const parsed = parsePerk(raw);
  if (!parsed.ok) return parsed;
  const db = getDb();
  const [owner] = await db.select({ id: partner.id }).from(partner).where(eq(partner.id, parsed.value.partnerId));
  if (!owner) return fail("That shop could not be found.");
  await db.insert(perk).values({ ...parsed.value, status: "live" });
  return { ok: true };
}

/** Name and area only: kind and schools stay as they were (end the shop and add a new one to change those). */
export async function updatePartner(adminId: string, partnerId: string, raw: unknown): Promise<AdminResult> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const name = text(input.name, "name", 120);
  if (!name.ok) return name;
  const area = text(input.area, "area", 120);
  if (!area.ok) return area;
  const done = await getDb().update(partner).set({ name: name.value, area: area.value }).where(eq(partner.id, partnerId)).returning({ id: partner.id });
  return done.length === 0 ? fail("That shop could not be found.") : { ok: true };
}

/** Title, terms, end date and total quantity. The per-student limit is not editable: end the perk and add a new one. */
export async function updatePerk(adminId: string, perkId: string, raw: unknown): Promise<AdminResult> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  const input = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const title = text(input.title, "title", 120);
  if (!title.ok) return title;
  const terms = text(input.terms, "terms", 500);
  if (!terms.ok) return terms;
  const total = wholeNumber(input.totalQuantity, "the total quantity", 1, 100000);
  if (!total.ok) return total;
  const endsAt = parseEndsAt(input.endsAt);
  if (!endsAt.ok) return endsAt;
  const done = await getDb()
    .update(perk)
    .set({ title: title.value, terms: terms.value, totalQuantity: total.value, endsAt: endsAt.value })
    .where(eq(perk.id, perkId))
    .returning({ id: perk.id });
  return done.length === 0 ? fail("That perk could not be found.") : { ok: true };
}

export async function setPartnerStatus(adminId: string, partnerId: string, status: unknown): Promise<AdminResult> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  if (status !== "active" && status !== "paused" && status !== "ended") return fail("Choose active, paused or ended.");
  const done = await getDb().update(partner).set({ status }).where(eq(partner.id, partnerId)).returning({ id: partner.id });
  return done.length === 0 ? fail("That shop could not be found.") : { ok: true };
}

export async function setPerkStatus(adminId: string, perkId: string, status: unknown): Promise<AdminResult> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  if (status !== "live" && status !== "paused" && status !== "ended") return fail("Choose live, paused or ended.");
  const done = await getDb().update(perk).set({ status }).where(eq(perk.id, perkId)).returning({ id: perk.id });
  return done.length === 0 ? fail("That perk could not be found.") : { ok: true };
}

export async function newPartnerPin(adminId: string, partnerId: string): Promise<AdminResult<{ pin: string }>> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  const pin = newPin();
  const done = await getDb().update(partner).set({ pin }).where(eq(partner.id, partnerId)).returning({ id: partner.id });
  return done.length === 0 ? fail("That shop could not be found.") : { ok: true, pin };
}

/** A new report link; the old one stops working. Also makes the first link for a shop that has none. */
export async function newReportLink(adminId: string, partnerId: string): Promise<AdminResult> {
  if (!(await isAdmin(adminId))) return fail(NOT_ADMIN);
  const done = await getDb().update(partner).set({ reportToken: newReportToken() }).where(eq(partner.id, partnerId)).returning({ id: partner.id });
  return done.length === 0 ? fail("That shop could not be found.") : { ok: true };
}
