import { describe, expect, it } from "vitest";
import { DEFAULT_PERIOD_DAYS, fillDays, manilaDay, parsePeriodDays, periodEnding, ratio } from "./series";

describe("manilaDay", () => {
  it("reads the Manila calendar day, which starts at 16:00 UTC the evening before", () => {
    expect(manilaDay(new Date("2026-10-20T15:59:59Z"))).toBe("2026-10-20");
    expect(manilaDay(new Date("2026-10-20T16:00:00Z"))).toBe("2026-10-21");
    expect(manilaDay(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});

describe("periodEnding", () => {
  it("has one key per day, oldest first, ending on the Manila day of now", () => {
    const period = periodEnding(7, new Date("2026-03-01T20:00:00Z")); // 04:00 on Mar 2 in Manila
    expect(period.dayKeys).toEqual(["2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(period.startsAt.toISOString()).toBe("2026-02-23T16:00:00.000Z");
    expect(period.endsAt.toISOString()).toBe("2026-03-01T20:00:00.000Z");
  });

  it("covers leap days and year ends", () => {
    expect(periodEnding(7, new Date("2028-03-02T04:00:00Z")).dayKeys[0]).toBe("2028-02-25");
    expect(periodEnding(7, new Date("2028-03-02T04:00:00Z")).dayKeys).toContain("2028-02-29");
    expect(periodEnding(30, new Date("2027-01-10T04:00:00Z")).dayKeys[0]).toBe("2026-12-12");
    expect(periodEnding(90, new Date("2026-10-20T04:00:00Z")).dayKeys).toHaveLength(90);
  });
});

describe("parsePeriodDays", () => {
  it("accepts only 7, 30 and 90", () => {
    expect(parsePeriodDays("7")).toBe(7);
    expect(parsePeriodDays("90")).toBe(90);
    expect(parsePeriodDays(["7", "90"])).toBe(7);
    for (const bad of [undefined, "", "0", "8", "-7", "7.0", "seven", "30; drop table", "007"]) {
      expect(parsePeriodDays(bad)).toBe(DEFAULT_PERIOD_DAYS);
    }
  });
});

describe("fillDays", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-03"];

  it("gives a zero for every day and key with nothing", () => {
    expect(fillDays(days, ["a", "b"], [])).toEqual(days.map((day) => ({ day, total: 0, parts: { a: 0, b: 0 } })));
  });

  it("adds rows to their day and key, and ignores days outside the period and unknown keys", () => {
    const points = fillDays(days, ["a", "b"], [
      { day: "2026-10-02", key: "a", n: 2 },
      { day: "2026-10-02", key: "b", n: 3 },
      { day: "2026-10-02", key: "a", n: 1 },
      { day: "2026-09-30", key: "a", n: 9 },
      { day: "2026-10-03", key: "other", n: 9 },
    ]);
    expect(points[1]).toEqual({ day: "2026-10-02", total: 6, parts: { a: 3, b: 3 } });
    expect(points[0].total).toBe(0);
    expect(points[2].total).toBe(0);
  });
});

describe("ratio", () => {
  it("divides", () => {
    expect(ratio(1, 4)).toEqual({ numerator: 1, denominator: 4, share: 0.25 });
    expect(ratio(0, 5).share).toBe(0);
  });

  it("is null, not NaN or Infinity, with a zero denominator", () => {
    expect(ratio(0, 0)).toEqual({ numerator: 0, denominator: 0, share: null });
    expect(ratio(3, 0).share).toBeNull();
  });
});
