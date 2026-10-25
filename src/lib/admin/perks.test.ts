import { describe, expect, it } from "vitest";
import { conversionOf, newPin, newReportToken, parseEndsAt, parsePartner, parsePerk } from "./perks";

const NOW = new Date("2026-10-25T04:00:00Z");
const partnerId = "11111111-1111-4111-8111-111111111111";

describe("perk input", () => {
  it("reads the end date as the end of that day in Manila, and only in the future", () => {
    expect(parseEndsAt("2026-10-30", NOW)).toEqual({ ok: true, value: new Date("2026-10-30T15:59:59Z") });
    expect(parseEndsAt("", NOW)).toEqual({ ok: true, value: null });
    expect(parseEndsAt("2026-10-24", NOW)).toMatchObject({ ok: false });
    expect(parseEndsAt("30/10/2026", NOW)).toMatchObject({ ok: false });
  });

  it("needs a period whenever there is a limit, and none when there is not", () => {
    const base = { partnerId, title: "Buy 5 get 1", terms: "Show the voucher." };
    expect(parsePerk({ ...base, limitPerStudent: "1", limitPeriod: "day" }, NOW)).toMatchObject({ ok: true, value: { limitPerStudent: 1, limitPeriod: "day" } });
    expect(parsePerk({ ...base, limitPerStudent: "1", limitPeriod: "never" }, NOW)).toMatchObject({ ok: false });
    expect(parsePerk({ ...base, limitPerStudent: "", limitPeriod: "day" }, NOW)).toMatchObject({ ok: true, value: { limitPerStudent: null, limitPeriod: null } });
  });

  it("refuses empty, over-long and non-numeric values", () => {
    expect(parsePerk({ partnerId, title: "  ", terms: "x" }, NOW)).toMatchObject({ ok: false });
    expect(parsePerk({ partnerId, title: "x", terms: "y".repeat(501) }, NOW)).toMatchObject({ ok: false });
    expect(parsePerk({ partnerId, title: "x", terms: "y", totalQuantity: "12a" }, NOW)).toMatchObject({ ok: false });
    expect(parsePerk({ partnerId: "nope", title: "x", terms: "y" }, NOW)).toMatchObject({ ok: false });
  });
});

describe("partner input", () => {
  it("makes a 4-digit PIN when none is given, and keeps a valid one", () => {
    const made = parsePartner({ name: "Shop", kind: "food", area: "Main gate" });
    expect(made.ok && made.value.pin).toMatch(/^\d{4}$/);
    expect(parsePartner({ name: "Shop", kind: "food", area: "Main gate", pin: "0420" })).toMatchObject({ ok: true, value: { pin: "0420" } });
    expect(parsePartner({ name: "Shop", kind: "food", area: "Main gate", pin: "42" })).toMatchObject({ ok: false });
  });

  it("treats no ticked school as every school, and rejects an unknown kind", () => {
    expect(parsePartner({ name: "Shop", kind: "food", area: "x", schoolDomains: [] })).toMatchObject({ ok: true, value: { schoolDomains: null } });
    expect(parsePartner({ name: "Shop", kind: "food", area: "x", schoolDomains: ["a.edu.ph"] })).toMatchObject({ ok: true, value: { schoolDomains: ["a.edu.ph"] } });
    expect(parsePartner({ name: "Shop", kind: "spaceships", area: "x" })).toMatchObject({ ok: false });
  });
});

describe("numbers", () => {
  it("makes PINs and report tokens in the shapes the database checks", () => {
    for (let i = 0; i < 50; i += 1) expect(newPin()).toMatch(/^\d{4}$/);
    expect(newReportToken()).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("works out conversion, with a dash for no claims", () => {
    expect(conversionOf(0, 0)).toBeNull();
    expect(conversionOf(3, 1)).toBe(33);
    expect(conversionOf(2, 2)).toBe(100);
  });
});
