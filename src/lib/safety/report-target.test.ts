import { describe, expect, it } from "vitest";
import { parsePostLink, parseReportHandle } from "./report-target";

const ID = "123e4567-e89b-42d3-a456-426614174000";

describe("parsePostLink", () => {
  it("reads a full address on any host", () => {
    for (const link of [
      `https://studiskarte.com/posts/${ID}`,
      `http://localhost:3000/posts/${ID}`,
      `https://www.example.org/posts/${ID}/`,
      `https://studiskarte.com/posts/${ID}?from=share#photos`,
      `studiskarte.com/posts/${ID}`,
      `  https://studiskarte.com/posts/${ID}\n`,
    ]) {
      expect(parsePostLink(link)).toBe(ID);
    }
  });

  it("reads a path and a bare id, in any case", () => {
    expect(parsePostLink(`/posts/${ID}`)).toBe(ID);
    expect(parsePostLink(`/posts/${ID.toUpperCase()}`)).toBe(ID);
    expect(parsePostLink(ID)).toBe(ID);
    expect(parsePostLink(ID.toUpperCase())).toBe(ID);
  });

  it("turns away anything that is not a listing link", () => {
    for (const bad of [
      "",
      "   ",
      "hello",
      "https://studiskarte.com/",
      "https://studiskarte.com/posts/new",
      "https://studiskarte.com/posts/not-an-id",
      `https://studiskarte.com/profile/${ID}`,
      `https://studiskarte.com/posts/${ID}x`,
      `https://studiskarte.com/posts/${ID.slice(0, -1)}`,
      `look at /posts/${ID}`,
      `${ID} ${ID}`,
      null,
      undefined,
      5,
    ]) {
      expect(parsePostLink(bad)).toBeNull();
    }
  });
});

describe("parseReportHandle", () => {
  it("trims, drops a leading @ and lowercases", () => {
    expect(parseReportHandle("  @Ana.Cruz ")).toEqual({ ok: true, handle: "ana.cruz" });
    expect(parseReportHandle("ben_99")).toEqual({ ok: true, handle: "ben_99" });
  });

  it("says what is wrong with an empty or badly formed handle", () => {
    expect(parseReportHandle("")).toMatchObject({ ok: false });
    expect(parseReportHandle(" @ ")).toMatchObject({ ok: false });
    expect(parseReportHandle("ab")).toMatchObject({ ok: false });
    expect(parseReportHandle("a".repeat(21))).toMatchObject({ ok: false });
    expect(parseReportHandle("ana cruz")).toMatchObject({ ok: false });
    expect(parseReportHandle("ana..cruz")).toMatchObject({ ok: false });
    expect(parseReportHandle(null)).toMatchObject({ ok: false });
  });

  it("does not turn a reserved word away: the report functions answer whether anyone has it", () => {
    expect(parseReportHandle("@Admin")).toEqual({ ok: true, handle: "admin" });
  });
});
