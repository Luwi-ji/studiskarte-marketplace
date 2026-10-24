import { describe, expect, it } from "vitest";
import { BIO_MAX, checkBio } from "./bio";

describe("checkBio", () => {
  it("trims and keeps ordinary text", () => {
    expect(checkBio("  Selling my old textbooks.  ")).toEqual({ ok: true, bio: "Selling my old textbooks." });
  });

  it("turns newlines, tabs and runs of spaces into single spaces", () => {
    expect(checkBio("BSIT\r\n\r\n3rd year\t\tTUP   Manila\n")).toEqual({ ok: true, bio: "BSIT 3rd year TUP Manila" });
  });

  it("drops control and bidi characters", () => {
    expect(checkBio("hi\u0000 th\u202Eere\u200B!")).toEqual({ ok: true, bio: "hi there!" });
  });

  it("keeps emoji joiners", () => {
    expect(checkBio("\u{1F469}\u200D\u{1F4BB} dev")).toEqual({ ok: true, bio: "\u{1F469}\u200D\u{1F4BB} dev" });
  });

  it("treats blank text as no bio", () => {
    expect(checkBio("")).toEqual({ ok: true, bio: null });
    expect(checkBio(" \n\t\u200B ")).toEqual({ ok: true, bio: null });
  });

  it("accepts exactly the limit and refuses one more", () => {
    expect(checkBio("a".repeat(BIO_MAX))).toEqual({ ok: true, bio: "a".repeat(BIO_MAX) });
    expect(checkBio("a".repeat(BIO_MAX + 1))).toEqual({ ok: false, message: `Use at most ${BIO_MAX} characters.` });
  });

  it("measures the length after cleaning, not before", () => {
    expect(checkBio(`${" ".repeat(50)}${"a".repeat(BIO_MAX)}${"\n".repeat(50)}`).ok).toBe(true);
  });
});
