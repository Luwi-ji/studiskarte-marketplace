import { describe, expect, it } from "vitest";
import { photosOf } from "@/test/photos";
import { addDays, manilaToday, parseDate, parseNewPost, parsePostEdit, parseTime, type NewPostInput } from "./schema";

const now = new Date("2026-10-16T04:00:00Z"); // 12:00 on 16 October in Manila
const categories: Record<string, { requiresCondition: boolean }> = {
  "electronics": { requiresCondition: true },
  "services": { requiresCondition: false },
};
const lookup = (id: string) => categories[id];
const photo = "5b0c2a7e-6d3f-4c1a-9e8b-1f2a3b4c5d6e";

function valid(overrides: Partial<NewPostInput> = {}): NewPostInput {
  return {
    kind: "showcase",
    title: " Casio fx-991ES ",
    description: "Works perfectly, with cover.",
    categoryId: "electronics",
    condition: "used_good",
    priceKind: "amount",
    priceAmount: "₱1,200",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "TUP main gate",
    deliveryArea: "",
    availability: [{ kind: "weekly", weekday: 1, startTime: "13:00", endTime: "17:00" }],
    photos: photosOf([photo]),
    ...overrides,
  };
}

function errorsOf(input: unknown) {
  const result = parseNewPost(input, lookup, now);
  if (result.ok) throw new Error("expected the input to be rejected");
  return result.errors;
}

describe("parseNewPost", () => {
  it("accepts a complete post and normalizes it", () => {
    const result = parseNewPost(valid(), lookup, now);
    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        kind: "showcase",
        title: "Casio fx-991ES",
        priceKind: "amount",
        priceAmount: 1200,
        meetupLocation: "TUP main gate",
        deliveryArea: null,
        availability: [{ kind: "weekly", weekday: 1, startTime: "13:00", endTime: "17:00" }],
      }),
    });
  });

  it.each([
    ["no photo", { photos: photosOf([]) }, "photos"],
    ["11 photos", { photos: photosOf(Array(11).fill(photo)) }, "photos"],
    ["the same photo twice", { photos: photosOf([photo, photo]) }, "photos"],
    ["empty title", { title: "   " }, "title"],
    ["empty description", { description: "" }, "description"],
    ["zero amount", { priceAmount: "0" }, "priceAmount"],
    ["negative amount", { priceAmount: "-50" }, "priceAmount"],
    ["centavos", { priceAmount: "99.50" }, "priceAmount"],
    ["amount over ₱1,000,000", { priceAmount: "1000001" }, "priceAmount"],
    ["no exchange option", { exchangeMeetup: false, exchangeDelivery: false }, "exchange"],
    ["meet-up without a place", { meetupLocation: "  " }, "meetupLocation"],
    ["delivery without an area", { exchangeDelivery: true, deliveryArea: "" }, "deliveryArea"],
    ["condition missing where needed", { condition: null }, "condition"],
    ["unknown category", { categoryId: "no-such-category" }, "categoryId"],
    ["no kind", { kind: undefined }, "kind"],
  ])("rejects %s", (_label, overrides, field) => {
    expect(errorsOf(valid(overrides as Partial<NewPostInput>))).toHaveProperty([field]);
  });

  it("drops a condition sent for a category that takes none", () => {
    const result = parseNewPost(
      valid({ categoryId: "services", condition: "new", priceKind: "negotiable", priceAmount: "" }),
      lookup,
      now,
    );
    expect(result.ok && result.data).toMatchObject({ condition: null, priceKind: "negotiable", priceAmount: null });
  });

  it("reports every problem in one pass, not one step at a time", () => {
    const errors = errorsOf(
      valid({
        title: "",
        description: "",
        photos: photosOf([]),
        categoryId: "",
        meetupLocation: "",
        availability: [{ kind: "weekly", weekday: 1, startTime: "", endTime: "" }],
      }),
    );
    expect(Object.keys(errors).filter((key) => errors[key])).toEqual(
      expect.arrayContaining(["title", "description", "photos", "categoryId", "meetupLocation", "availability.0"]),
    );
  });

  it("drops the place of an exchange option that was not chosen", () => {
    const result = parseNewPost(valid({ exchangeMeetup: false, exchangeDelivery: true, deliveryArea: "Within Ermita" }), lookup, now);
    expect(result.ok && result.data).toMatchObject({ meetupLocation: null, deliveryArea: "Within Ermita" });
  });

  it("treats free as its own price, never as an amount", () => {
    const result = parseNewPost(valid({ priceKind: "free", priceAmount: "500" }), lookup, now);
    expect(result.ok && result.data).toMatchObject({ priceKind: "free", priceAmount: null });
  });
});

describe("availability", () => {
  const availabilityOf = (availability: NewPostInput["availability"]) => {
    const result = parseNewPost(valid({ availability }), lookup, now);
    return result.ok ? result.data.availability : result.errors;
  };

  it("accepts several weekdays with their own times", () => {
    expect(
      availabilityOf([
        { kind: "weekly", weekday: 1, startTime: "08:00", endTime: "10:00" },
        { kind: "weekly", weekday: 3, startTime: "15:30", endTime: "18:00" },
      ]),
    ).toHaveLength(2);
  });

  it("accepts dates from today up to 60 days ahead", () => {
    expect(
      availabilityOf([
        { kind: "date", date: "2026-10-16", startTime: "13:00", endTime: "14:00" },
        { kind: "date", date: "2026-12-15", startTime: "09:00", endTime: "10:00" },
      ]),
    ).toEqual([
      { kind: "date", date: "2026-10-16", startTime: "13:00", endTime: "14:00" },
      { kind: "date", date: "2026-12-15", startTime: "09:00", endTime: "10:00" },
    ]);
  });

  it("accepts times with seconds, as iPhone Safari sends them", () => {
    expect(availabilityOf([{ kind: "weekly", weekday: 2, startTime: "13:00:00", endTime: "17:30:00.000" }])).toEqual([
      { kind: "weekly", weekday: 2, startTime: "13:00", endTime: "17:30" },
    ]);
  });

  it.each([
    ["nothing chosen", [], "availability"],
    ["15 entries", Array.from({ length: 15 }, (_, i) => ({ kind: "date" as const, date: addDays("2026-10-17", i), startTime: "09:00", endTime: "10:00" })), "availability"],
    ["a missing end time", [{ kind: "weekly" as const, weekday: 1, startTime: "09:00", endTime: "" }], "availability.0"],
    ["an end before the start", [{ kind: "weekly" as const, weekday: 1, startTime: "17:00", endTime: "09:00" }], "availability.0"],
    ["an end equal to the start", [{ kind: "weekly" as const, weekday: 1, startTime: "09:00", endTime: "09:00" }], "availability.0"],
    ["a weekday out of range", [{ kind: "weekly" as const, weekday: 7, startTime: "09:00", endTime: "10:00" }], "availability.0"],
    ["a past date", [{ kind: "date" as const, date: "2026-10-15", startTime: "09:00", endTime: "10:00" }], "availability.0"],
    ["a date more than 60 days ahead", [{ kind: "date" as const, date: "2026-12-16", startTime: "09:00", endTime: "10:00" }], "availability.0"],
    ["an impossible date", [{ kind: "date" as const, date: "2026-02-30", startTime: "09:00", endTime: "10:00" }], "availability.0"],
    [
      "the same weekday twice",
      [
        { kind: "weekly" as const, weekday: 1, startTime: "09:00", endTime: "10:00" },
        { kind: "weekly" as const, weekday: 1, startTime: "13:00", endTime: "14:00" },
      ],
      "availability.1",
    ],
  ])("rejects %s", (_label, availability, field) => {
    expect(availabilityOf(availability)).toHaveProperty([field]);
  });
});

describe("photo captions", () => {
  const second = "6c1d3b8f-7e4a-4d2b-8f9c-2a3b4c5d6e7f";
  it("trims captions and treats a blank one as none", () => {
    const result = parseNewPost(valid({ photos: [{ id: photo, caption: "  Front view " }, { id: second, caption: "   " }] }), lookup, now);
    expect(result.ok && result.data.photos).toEqual([
      { id: photo, caption: "Front view" },
      { id: second, caption: null },
    ]);
  });

  it("refuses a caption over 300 characters, naming the photo", () => {
    expect(errorsOf(valid({ photos: [{ id: photo, caption: "x".repeat(301) }] }))).toHaveProperty(["photos.0"]);
  });
});

describe("parsePostEdit", () => {
  it("ignores an attempt to change the kind", () => {
    const result = parsePostEdit(valid({ kind: "wishlist" }), lookup, now);
    expect(result.ok && "kind" in result.data).toBe(false);
  });
});

describe("time and date helpers", () => {
  it.each([
    ["09:30", "09:30"],
    ["09:30:00", "09:30"],
    ["23:59:59.999", "23:59"],
    ["24:00", null],
    ["9:30", null],
    ["", null],
  ])("parseTime(%j) is %j", (input, expected) => {
    expect(parseTime(input)).toBe(expected);
  });

  it.each([
    ["2028-02-29", "2028-02-29"],
    ["2026-02-29", null],
    ["2026-13-01", null],
    ["16/10/2026", null],
  ])("parseDate(%j) is %j", (input, expected) => {
    expect(parseDate(input)).toBe(expected);
  });

  it("uses the Philippine date, which is a day ahead of UTC in the evening", () => {
    expect(manilaToday(new Date("2026-10-16T17:30:00Z"))).toBe("2026-10-17");
  });
});
