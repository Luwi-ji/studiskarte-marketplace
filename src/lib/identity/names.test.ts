import { describe, expect, it } from "vitest";
import { checkDisplayName, checkHandle, nextHandleChangeAt } from "./names";

describe("checkHandle", () => {
  it.each([
    ["juan", "juan"],
    ["  @Juan.Dela_Cruz ", "juan.dela_cruz"],
    ["abc", "abc"],
    ["a".repeat(20), "a".repeat(20)],
    ["_x_", "_x_"],
    ["tup.2026", "tup.2026"],
  ])("accepts %j as %j", (raw, handle) => {
    expect(checkHandle(raw)).toEqual({ ok: true, handle });
  });

  it.each([
    ["ab", "length"],
    ["a".repeat(21), "length"],
    ["juan dela", "characters"],
    ["juañ", "characters"],
    ["juan-dc", "characters"],
    ["😀abc", "characters"],
    [".juan", "dots"],
    ["juan.", "dots"],
    ["ju..an", "dots"],
    ["admin", "reserved"],
    ["Ad.Min_", "reserved"],
    ["studiskarte", "reserved"],
  ])("rejects %j (%s)", (raw, problem) => {
    expect(checkHandle(raw)).toEqual({ ok: false, problem });
  });
});

describe("checkDisplayName", () => {
  it("trims and accepts ñ and emoji", () => {
    expect(checkDisplayName("  Niño 🌻 Santos ")).toEqual({ ok: true, name: "Niño 🌻 Santos" });
  });

  it("counts an emoji made of several code points as one character", () => {
    const family = "👨‍👩‍👧‍👦"; // 7 code points, 1 visible character
    expect(checkDisplayName(family.repeat(40)).ok).toBe(true);
    expect(checkDisplayName(family.repeat(41)).ok).toBe(false);
  });

  it.each(["", "   ", "two\nlines", "x".repeat(41)])("rejects %j", (raw) => {
    expect(checkDisplayName(raw).ok).toBe(false);
  });

  it.each(["Admin", " ADMIN ", "A.d-m_i n", "Support", "Studiskarte Support", "studiskarte", "Deleted student"])("refuses the staff-like name %j", (raw) => {
    expect(checkDisplayName(raw)).toEqual({ ok: false, message: "That name is reserved. Choose another." });
  });

  it("removes characters that reorder or hide text, but keeps the joiners emoji need", () => {
    expect(checkDisplayName("\u202Eevil\u200B name\u2066")).toEqual({ ok: true, name: "evil name" });
    expect(checkDisplayName("\u202Eadmin\u200B")).toMatchObject({ ok: false });
    const family = "👨‍👩‍👧‍👦";
    expect(checkDisplayName(family)).toEqual({ ok: true, name: family });
  });
});

describe("nextHandleChangeAt", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("allows a change when the handle was never changed", () => {
    expect(nextHandleChangeAt(null, now)).toBeNull();
  });

  it("blocks a change for 30 days after the last one", () => {
    const last = new Date("2026-10-01T12:00:00Z");
    expect(nextHandleChangeAt(last, now)).toEqual(new Date("2026-10-31T12:00:00Z"));
  });

  it("allows a change exactly 30 days later", () => {
    const last = new Date("2026-09-16T12:00:00Z");
    expect(nextHandleChangeAt(last, now)).toBeNull();
  });
});
