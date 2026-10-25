import { describe, expect, it } from "vitest";
import { checkLocation, LOCATION_MAX } from "./location";

describe("checkLocation", () => {
  it("cleans whitespace and keeps the place", () => {
    expect(checkLocation("  Sampaloc,\n  Manila \t")).toEqual({ ok: true, location: "Sampaloc, Manila" });
  });

  it("treats nothing as none, so a location can be cleared", () => {
    expect(checkLocation("")).toEqual({ ok: true, location: null });
    expect(checkLocation("   \u200B ")).toEqual({ ok: true, location: null });
  });

  it("refuses one character and over-long text, counting letters not bytes", () => {
    expect(checkLocation("M")).toMatchObject({ ok: false });
    expect(checkLocation("a".repeat(LOCATION_MAX))).toMatchObject({ ok: true });
    expect(checkLocation("a".repeat(LOCATION_MAX + 1))).toMatchObject({ ok: false });
    expect(checkLocation("ñ".repeat(LOCATION_MAX))).toMatchObject({ ok: true });
  });
});
