import { describe, expect, it } from "vitest";
import { parseUtm, readUtmCookie, serializeUtm } from "./utm";

const parse = (query: string) => parseUtm(new URLSearchParams(query));

describe("parseUtm", () => {
  it("keeps valid values and lowercases them", () => {
    expect(parse("utm_source=IG&utm_medium=bio&utm_campaign=Launch-1")).toEqual({ source: "ig", medium: "bio", campaign: "launch-1" });
  });

  it("drops values that are not short plain tokens", () => {
    expect(parse("utm_source=a b")).toBeNull();
    expect(parse("utm_source=a/b")).toBeNull();
    expect(parse("utm_source=%3Cscript%3E")).toBeNull();
    expect(parse(`utm_source=${"a".repeat(65)}`)).toBeNull();
    expect(parse("utm_source=a b&utm_medium=bio")).toEqual({ medium: "bio" });
  });

  it("accepts exactly 64 characters", () => {
    expect(parse(`utm_source=${"a".repeat(64)}`)).toEqual({ source: "a".repeat(64) });
  });

  it("ignores other params and returns null when nothing survives", () => {
    expect(parse("fbclid=abc&ref=x")).toBeNull();
    expect(parse("")).toBeNull();
  });
});

describe("utm cookie", () => {
  it("round-trips", () => {
    const utm = { source: "ig", medium: "bio", campaign: "launch" };
    expect(readUtmCookie(serializeUtm(utm))).toEqual(utm);
    expect(readUtmCookie(serializeUtm({ source: "ig" }))).toEqual({ source: "ig" });
  });

  it("never trusts the cookie", () => {
    expect(readUtmCookie(undefined)).toBeNull();
    expect(readUtmCookie("utm_source=a b")).toBeNull();
  });
});
