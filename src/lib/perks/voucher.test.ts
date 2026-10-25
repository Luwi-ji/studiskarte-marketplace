import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { partner, perk, perkVoucher, rateLimitEvent, school } from "@/db/schema";
import { getDb } from "@/lib/db";
import { listPerks } from "@/lib/perks/list";
import { claimPerk, redeemVoucher, studentPerkState } from "@/lib/perks/voucher";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 6);
const domain = `pv${run}.edu.ph`;
const PIN = "4821";
const students: string[] = [];
const partnerIds: string[] = [];

async function makeStudent(name: string, fields: { visitor?: boolean } = {}) {
  const id = `pv-${name}-${run}`;
  await createTestStudent(id, fields.visitor ? { visitor: true } : { schoolDomain: domain });
  students.push(id);
  return id;
}

async function makePartner(fields: { pin?: string | null; status?: string } = {}) {
  const [row] = await db
    .insert(partner)
    .values({ name: `Shop ${run}`, kind: "food", area: `Area ${run}`, status: fields.status ?? "active", schoolDomains: [domain], pin: fields.pin === undefined ? PIN : fields.pin })
    .returning({ id: partner.id });
  partnerIds.push(row.id);
  return row.id;
}

async function makePerk(partnerId: string, fields: { limit?: [number, string]; total?: number; status?: string } = {}) {
  const [row] = await db
    .insert(perk)
    .values({
      partnerId,
      title: `Perk ${run}`,
      terms: "Terms.",
      status: fields.status ?? "live",
      startsAt: new Date(Date.now() - 60_000),
      limitPerStudent: fields.limit?.[0] ?? null,
      limitPeriod: fields.limit?.[1] ?? null,
      totalQuantity: fields.total ?? null,
    })
    .returning({ id: perk.id });
  return row.id;
}

const must = async (studentId: string, perkId: string) => {
  const result = await claimPerk({ studentId, perkId });
  if (!result.ok) throw new Error(result.error);
  return result.voucher;
};

beforeAll(async () => {
  await db.insert(school).values({ domain }).onConflictDoNothing();
});

afterAll(async () => {
  if (partnerIds.length > 0) await db.delete(partner).where(inArray(partner.id, partnerIds));
  if (students.length > 0) await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, students));
  for (const id of students) await deleteTestStudent(id);
  await db.delete(school).where(eq(school.domain, domain));
});

describe("claiming", () => {
  it("makes a code like ST-4F8K and returns the same open voucher on a second claim", async () => {
    const me = await makeStudent("a");
    const perkId = await makePerk(await makePartner());
    const first = await must(me, perkId);
    expect(first.code).toMatch(/^ST-[A-HJKMNP-Z2-9]{4}$/);
    expect((await must(me, perkId)).id).toBe(first.id);
  });

  it("refuses a second claim in the limit period after redeeming, and two claims at once make one voucher", async () => {
    const me = await makeStudent("b");
    const perkId = await makePerk(await makePartner(), { limit: [1, "day"] });
    const [x, y] = await Promise.all([claimPerk({ studentId: me, perkId }), claimPerk({ studentId: me, perkId })]);
    expect(x.ok && y.ok).toBe(true);
    const rows = await db.select({ id: perkVoucher.id }).from(perkVoucher).where(and(eq(perkVoucher.perkId, perkId), eq(perkVoucher.studentId, me)));
    expect(rows).toHaveLength(1);

    const voucher = x.ok ? x.voucher : null;
    expect(await redeemVoucher({ studentId: me, voucherId: voucher!.id, pin: PIN })).toMatchObject({ ok: true });
    expect(await claimPerk({ studentId: me, perkId })).toEqual({ ok: false, error: "You have already claimed this today." });
  });

  it("does not let an unredeemed voucher that ran out count against the limit or the stock", async () => {
    const me = await makeStudent("c");
    const other = await makeStudent("d");
    const perkId = await makePerk(await makePartner(), { limit: [1, "day"], total: 1 });
    await db.insert(perkVoucher).values({ perkId, studentId: me, code: `ST-X${run.slice(0, 3).toUpperCase()}`.slice(0, 7), expiresAt: new Date(Date.now() - 1000) });
    const [state] = [...(await studentPerkState(me, [{ id: perkId, limitPerStudent: 1, limitPeriod: "day" }])).values()];
    expect(state).toEqual({ open: null, used: 0 });
    const item = (await listPerks(domain)).find((p) => p.id === perkId);
    expect(item?.left).toBe(1);
    expect(await claimPerk({ studentId: other, perkId })).toMatchObject({ ok: true });
  });

  it("stops at the total quantity, and a perk with a quantity holds a voucher a day, one without three", async () => {
    const [a, b, c] = [await makeStudent("e"), await makeStudent("f"), await makeStudent("g")];
    const limited = await makePerk(await makePartner(), { total: 2 });
    const first = await must(a, limited);
    await must(b, limited);
    expect(await claimPerk({ studentId: c, perkId: limited })).toEqual({ ok: false, error: "All claimed. None left." });
    const hours = (first.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThan(25);
    // Expiring one frees its place.
    await db.update(perkVoucher).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(perkVoucher.id, first.id));
    expect(await claimPerk({ studentId: c, perkId: limited })).toMatchObject({ ok: true });

    const open = await makePerk(await makePartner());
    const days = ((await must(c, open)).expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.9);
    expect(days).toBeLessThan(3.1);
  });

  it("refuses a paused perk, a shop with no PIN, and a student with no school", async () => {
    const me = await makeStudent("h");
    const guest = await makeStudent("i", { visitor: true });
    const shop = await makePartner();
    expect(await claimPerk({ studentId: me, perkId: await makePerk(shop, { status: "paused" }) })).toEqual({ ok: false, error: "This perk is not available." });
    const noPin = await makePerk(await makePartner({ pin: null }));
    expect(await claimPerk({ studentId: me, perkId: noPin })).toEqual({ ok: false, error: "This shop is not ready to take claims yet." });
    expect(await claimPerk({ studentId: guest, perkId: await makePerk(shop) })).toEqual({ ok: false, error: "Verify your school email to claim perks." });
  });
});

describe("redeeming", () => {
  it("keeps the voucher claimed on a wrong PIN, and redeems once with the right one", async () => {
    const me = await makeStudent("j");
    const voucher = await must(me, await makePerk(await makePartner()));
    expect(await redeemVoucher({ studentId: me, voucherId: voucher.id, pin: "0000" })).toEqual({ ok: false, error: "Wrong PIN." });
    const [still] = await db.select({ status: perkVoucher.status }).from(perkVoucher).where(eq(perkVoucher.id, voucher.id));
    expect(still.status).toBe("claimed");

    const done = await redeemVoucher({ studentId: me, voucherId: voucher.id, pin: PIN });
    expect(done).toMatchObject({ ok: true });
    const [row] = await db.select({ status: perkVoucher.status, at: perkVoucher.redeemedAt }).from(perkVoucher).where(eq(perkVoucher.id, voucher.id));
    expect(row.status).toBe("redeemed");
    expect(row.at).not.toBeNull();
    expect(await redeemVoucher({ studentId: me, voucherId: voucher.id, pin: PIN })).toEqual({ ok: false, error: "This voucher was already used or has expired." });
  });

  it("cannot redeem an expired voucher or someone else's, or when the perk is paused", async () => {
    const me = await makeStudent("k");
    const other = await makeStudent("l");
    const shop = await makePartner();
    const perkId = await makePerk(shop);
    const voucher = await must(me, perkId);
    expect(await redeemVoucher({ studentId: other, voucherId: voucher.id, pin: PIN })).toEqual({ ok: false, error: "Voucher not found." });
    await db.update(perk).set({ status: "paused" }).where(eq(perk.id, perkId));
    expect(await redeemVoucher({ studentId: me, voucherId: voucher.id, pin: PIN })).toEqual({ ok: false, error: "This perk is paused right now." });
    await db.update(perk).set({ status: "live" }).where(eq(perk.id, perkId));
    await db.update(perkVoucher).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(perkVoucher.id, voucher.id));
    expect(await redeemVoucher({ studentId: me, voucherId: voucher.id, pin: PIN })).toEqual({ ok: false, error: "This voucher was already used or has expired." });
  });

  it("locks after 5 wrong PINs even for the right one, but correct redemptions never lock", async () => {
    const locked = await makeStudent("m");
    const shop = await makePartner();
    const voucher = await must(locked, await makePerk(shop));
    for (let i = 0; i < 5; i += 1) expect(await redeemVoucher({ studentId: locked, voucherId: voucher.id, pin: "1111" })).toEqual({ ok: false, error: "Wrong PIN." });
    expect(await redeemVoucher({ studentId: locked, voucherId: voucher.id, pin: PIN })).toEqual({ ok: false, error: "Too many wrong PINs. Wait 10 minutes and ask the cashier to try again." });

    const fine = await makeStudent("n");
    for (let i = 0; i < 6; i += 1) {
      const v = await must(fine, await makePerk(shop));
      expect(await redeemVoucher({ studentId: fine, voucherId: v.id, pin: PIN })).toMatchObject({ ok: true });
    }
  });
});
