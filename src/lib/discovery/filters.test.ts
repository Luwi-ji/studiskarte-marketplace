import { describe, expect, it } from "vitest";
import { activeFilterCount, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("reads every filter, the sort and the search words", () => {
    const f = parseFilters({
      school: "up.edu.ph",
      category: "electronics",
      kind: "wishlist",
      condition: "used_good",
      min: "100",
      max: "900",
      listed: "week",
      sort: "price_low",
      q: "  Casio   calculator ",
    });
    expect(f).toEqual({
      school: ["up.edu.ph"],
      category: ["electronics"],
      kind: "wishlist",
      condition: ["used_good"],
      priceMin: 100,
      priceMax: 900,
      listed: "week",
      sort: "price_low",
      query: "Casio calculator",
      terms: ["casio", "calculator"],
    });
    expect(activeFilterCount(f)).toBe(7);
  });

  it("ignores anything unreadable instead of failing, and defaults to newest", () => {
    const f = parseFilters({ kind: "bogus", condition: "mint", min: "-5", max: "1e9", listed: "year", sort: "random", school: "A B;drop", category: "x".repeat(99) });
    expect(f).toMatchObject({ sort: "newest", terms: [] });
    expect(activeFilterCount(f)).toBe(0);
  });

  it("treats empty values as not chosen and a repeated parameter as its first value", () => {
    expect(parseFilters({ kind: "", min: "", q: "" })).toMatchObject({ kind: undefined, priceMin: undefined, query: undefined });
    expect(parseFilters({ kind: ["showcase", "wishlist"] })).toMatchObject({ kind: "showcase" });
  });

  it("takes several categories, conditions and schools as a comma-separated list, each once, dropping unreadable ones", () => {
    const f = parseFilters({ category: "textbooks, supplies,textbooks,BAD CAT", condition: "new,used_good,mint", school: "a.edu.ph,b.edu.ph,x;y" });
    expect(f.category).toEqual(["textbooks", "supplies"]);
    expect(f.condition).toEqual(["new", "used_good"]);
    expect(f.school).toEqual(["a.edu.ph", "b.edu.ph"]);
    expect(parseFilters({ category: ",," }).category).toBeUndefined();
    expect(parseFilters({ condition: "mint" }).condition).toBeUndefined();
    expect(activeFilterCount(f)).toBe(3); // each group is one filter, however many it holds
  });

  it("puts a price range the right way round", () => {
    expect(parseFilters({ min: "900", max: "100" })).toMatchObject({ priceMin: 100, priceMax: 900 });
  });

  it("keeps words of two letters or more, once each, at most five", () => {
    expect(parseFilters({ q: "a bb bb cc dd ee ff gg" }).terms).toEqual(["bb", "cc", "dd", "ee", "ff"]);
    expect(parseFilters({ q: "a" })).toMatchObject({ query: "a", terms: [] });
    expect(parseFilters({ q: "x".repeat(300) }).query).toHaveLength(100);
  });

  it("does not count the sort or the search as a filter", () => {
    expect(activeFilterCount(parseFilters({ sort: "price_high", q: "lamp" }))).toBe(0);
  });
});
