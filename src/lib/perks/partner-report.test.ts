import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { partner, perk, perkVoucher, school } from "@/db/schema";
import { newReportToken, recentRedemptions } from "@/lib/admin/perks";
import { deleteAccount } from "@/lib/identity/delete-account";
import type { ObjectStore } from "@/lib/images/store";
import { getDb } from "@/lib/db";
import { getPartnerReport } from "@/lib/perks/partner-report";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 6);
const domain = `pr${run}.edu.ph`;
const student = `pr-${run}`;
const partnerIds: string[] = [];
const tokenA = newReportToken();
const tokenB = newReportToken();
const store: ObjectStore = { async put() {}, async delete() {}, async signedUrl(key) { return `memory://${key}`; } };

async function shop(name: string, token: string) {
  const [p] = await db.insert(partner).values({ name: `${name} ${run}`, kind: "food", area: "x", status: "active", pin: "1234", reportToken: token }).returning({ id: partner.id });
  partnerIds.push(p.id);
  const [x] = await db.insert(perk).values({ partnerId: p.id, title: `${name} perk`, terms: "t", status: "live", startsAt: new Date(Date.now() - 60_000) }).returning({ id: perk.id });
  return x.id;
}

beforeAll(async () => {
  await db.insert(school).values({ domain }).onConflictDoNothing();
  await createTestStudent(student, { schoolDomain: domain, handle: `pr_${run}` });
  const a = await shop("Alpha", tokenA);
  const b = await shop("Beta", tokenB);
  const future = new Date(Date.now() + 86_400_000);
  await db.insert(perkVoucher).values([
    { perkId: a, studentId: student, code: `ST-A${run.slice(0, 3).toUpperCase()}`.slice(0, 7), status: "redeemed", redeemedAt: new Date(), expiresAt: future },
    { perkId: b, studentId: student, code: `ST-B${run.slice(0, 3).toUpperCase()}`.slice(0, 7), status: "claimed", expiresAt: future },
  ]);
});

afterAll(async () => {
  await db.delete(partner).where(inArray(partner.id, partnerIds));
  await deleteTestStudent(student);
  await db.delete(school).where(eq(school.domain, domain));
});

describe("partner report", () => {
  it("shows a shop its own numbers and codes, and nothing about students", async () => {
    const report = await getPartnerReport(tokenA);
    expect(report?.partnerName).toBe(`Alpha ${run}`);
    expect(report?.perks).toEqual([{ title: "Alpha perk", status: "live", claimed: 1, redeemed: 1, expired: 0, conversion: 100 }]);
    expect(report?.recent).toHaveLength(1);
    expect(report?.recent[0].code).toMatch(/^ST-A/);
    expect(JSON.stringify(report)).not.toMatch(new RegExp(`${student}|pr_${run}|1234`));
  });

  it("keeps one shop's vouchers out of another's report", async () => {
    const report = await getPartnerReport(tokenB);
    expect(report?.perks[0]).toMatchObject({ title: "Beta perk", claimed: 1, redeemed: 0, conversion: 0 });
    expect(report?.recent).toEqual([]);
  });

  it("keeps a deleted account's voucher, so a shop's totals never drop", async () => {
    const leaver = `pr-leaver-${run}`;
    await createTestStudent(leaver, { schoolDomain: domain, handle: `prl_${run}` });
    const [p] = await db.select({ id: perk.id }).from(perk).innerJoin(partner, eq(partner.id, perk.partnerId)).where(eq(partner.reportToken, tokenA));
    const code = `ST-Z${run.slice(0, 3).toUpperCase()}`.slice(0, 7);
    await db.insert(perkVoucher).values({ perkId: p.id, studentId: leaver, code, status: "redeemed", redeemedAt: new Date(Date.now() + 1000), expiresAt: new Date(Date.now() + 86_400_000) });
    const before = await getPartnerReport(tokenA);

    expect(await deleteAccount({ studentId: leaver, confirmHandle: `prl_${run}`, store })).toEqual({ ok: true });

    expect(await getPartnerReport(tokenA)).toEqual(before);
    const row = (await recentRedemptions(50)).find((r) => r.code === code);
    expect(row?.handle).toBeNull();
    await deleteTestStudent(leaver);
  });

  it("refuses a token of the wrong shape and an unknown one", async () => {
    expect(await getPartnerReport("short")).toBeNull();
    expect(await getPartnerReport(`${tokenA}x`)).toBeNull();
    expect(await getPartnerReport(newReportToken())).toBeNull();
  });
});
