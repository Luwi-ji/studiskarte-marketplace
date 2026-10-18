import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { partner, perk, school } from "@/db/schema";
import { getDb } from "@/lib/db";
import { listPerks, perkFilterOptions } from "@/lib/perks/list";

const db = getDb();
const run = randomUUID().slice(0, 6);
const mine = `pk${run}.edu.ph`;
const other = `po${run}.edu.ph`;
const area = `Area ${run}`;
const partnerIds: string[] = [];

async function addPartner(fields: { name: string; kind?: string; area?: string; status?: string; schoolDomains?: string[] | null }) {
  const [row] = await db
    .insert(partner)
    .values({
      name: `${fields.name} ${run}`,
      kind: fields.kind ?? "food",
      area: fields.area ?? area,
      status: fields.status ?? "active",
      schoolDomains: fields.schoolDomains === undefined ? [mine] : fields.schoolDomains,
    })
    .returning({ id: partner.id });
  partnerIds.push(row.id);
  return row.id;
}

async function addPerk(partnerId: string, title: string, fields: { status?: string; startsAt?: Date; endsAt?: Date | null } = {}) {
  await db.insert(perk).values({
    partnerId,
    title: `${title} ${run}`,
    terms: "Terms.",
    status: fields.status ?? "live",
    startsAt: fields.startsAt ?? new Date(Date.now() - 60_000),
    endsAt: fields.endsAt ?? null,
  });
}

/** This run's perk titles only, so other rows in a shared database cannot change the result. */
async function seen(domain: string, filter?: Parameters<typeof listPerks>[1]): Promise<string[]> {
  const suffix = ` ${run}`;
  return (await listPerks(domain, filter))
    .map((p) => p.title)
    .filter((t) => t.endsWith(suffix))
    .map((t) => t.slice(0, -suffix.length))
    .sort();
}

describe("perks a student can see", () => {
  beforeAll(async () => {
    await db.insert(school).values([{ domain: mine }, { domain: other }]).onConflictDoNothing();
    const active = await addPartner({ name: "Active" });
    await addPerk(active, "live");
    await addPerk(active, "draft", { status: "draft" });
    await addPerk(active, "paused", { status: "paused" });
    await addPerk(active, "future", { startsAt: new Date(Date.now() + 3_600_000) });
    await addPerk(active, "ended", { startsAt: new Date(Date.now() - 7_200_000), endsAt: new Date(Date.now() - 3_600_000) });
    await addPerk(active, "until-later", { endsAt: new Date(Date.now() + 3_600_000) });

    const paused = await addPartner({ name: "Paused partner", status: "paused", kind: "clothes", area: `Hidden ${run}` });
    await addPerk(paused, "paused-partner-perk");
    const pending = await addPartner({ name: "Pending partner", status: "pending", area: `Pending ${run}` });
    await addPerk(pending, "pending-partner-perk");

    const elsewhere = await addPartner({ name: "Elsewhere", schoolDomains: [other], area: `Elsewhere ${run}` });
    await addPerk(elsewhere, "other-school-perk");
    const everywhere = await addPartner({ name: "Everywhere", schoolDomains: null, kind: "printing", area: `Far ${run}` });
    await addPerk(everywhere, "every-school-perk");
  });

  afterAll(async () => {
    if (partnerIds.length > 0) await db.delete(partner).where(inArray(partner.id, partnerIds));
    await db.delete(school).where(inArray(school.domain, [mine, other]));
  });

  it("lists only live, started, unfinished perks of active partners that serve the student's school", async () => {
    expect(await seen(mine)).toEqual(["every-school-perk", "live", "until-later"]);
  });

  it("keeps a school-specific partner away from other schools, while all-school partners show everywhere", async () => {
    expect(await seen(other)).toEqual(["every-school-perk", "other-school-perk"]);
  });

  it("narrows by kind and by area, and the filters combine", async () => {
    expect(await seen(mine, { kind: "printing" })).toEqual(["every-school-perk"]);
    expect(await seen(mine, { area })).toEqual(["live", "until-later"]);
    expect(await seen(mine, { kind: "printing", area })).toEqual([]);
  });

  it("offers filter areas only for perks the student can see", async () => {
    const options = await perkFilterOptions(mine);
    expect(options.areas).toEqual(expect.arrayContaining([area, `Far ${run}`]));
    expect(options.areas).not.toContain(`Hidden ${run}`);
    expect(options.areas).not.toContain(`Pending ${run}`);
    expect(options.areas).not.toContain(`Elsewhere ${run}`);
    expect(options.kinds).toEqual(expect.arrayContaining(["food", "printing"]));
  });
});
