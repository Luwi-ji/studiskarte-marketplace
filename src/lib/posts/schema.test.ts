import { describe, expect, it } from "vitest";
import { fromManilaLocal, parseNewPost, parsePostEdit, toManilaLocal, type NewPostInput } from "./schema";

const now = new Date("2026-10-16T04:00:00Z"); // 12:00 in Manila
const categories: Record<string, { requiresCondition: boolean }> = {
  "electronics.calculators": { requiresCondition: true },
  "services.tutoring": { requiresCondition: false },
};
const lookup = (id: string) => categories[id];
const photo = "5b0c2a7e-6d3f-4c1a-9e8b-1f2a3b4c5d6e";

function valid(overrides: Partial<NewPostInput> = {}): NewPostInput {
  return {
    kind: "showcase",
    title: " Casio fx-991ES ",
    description: "Works perfectly, with cover.",
    categoryId: "electronics.calculators",
    condition: "used_good",
    priceKind: "amount",
    priceAmount: "₱1,200",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "TUP main gate",
    deliveryArea: "",
    availability: [{ startsAt: "2026-10-17T13:00", endsAt: "2026-10-17T17:00" }],
    photoIds: [photo],
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
        availability: [
          { startsAt: new Date("2026-10-17T05:00:00Z"), endsAt: new Date("2026-10-17T09:00:00Z") },
        ],
      }),
    });
  });

  it.each([
    ["no photo", { photoIds: [] }, "photoIds"],
    ["11 photos", { photoIds: Array(11).fill(photo) }, "photoIds"],
    ["the same photo twice", { photoIds: [photo, photo] }, "photoIds"],
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
    ["unknown category", { categoryId: "electronics" }, "categoryId"],
    ["no availability", { availability: [] }, "availability"],
    ["end before start", { availability: [{ startsAt: "2026-10-17T17:00", endsAt: "2026-10-17T13:00" }] }, "availability.0"],
    ["a time already passed", { availability: [{ startsAt: "2026-10-15T09:00", endsAt: "2026-10-15T10:00" }] }, "availability.0"],
    ["no kind", { kind: undefined }, "kind"],
  ])("rejects %s", (_label, overrides, field) => {
    expect(errorsOf(valid(overrides as Partial<NewPostInput>))).toHaveProperty([field]);
  });

  it("drops a condition sent for a category that takes none", () => {
    const result = parseNewPost(
      valid({ categoryId: "services.tutoring", condition: "new", priceKind: "negotiable", priceAmount: "" }),
      lookup,
      now,
    );
    expect(result.ok && result.data).toMatchObject({ condition: null, priceKind: "negotiable", priceAmount: null });
  });

  it("reports every problem in one pass, not one step at a time", () => {
    const errors = errorsOf(
      valid({ title: "", description: "", photoIds: [], categoryId: "", meetupLocation: "", availability: [{ startsAt: "", endsAt: "" }] }),
    );
    expect(Object.keys(errors).filter((key) => errors[key])).toEqual(
      expect.arrayContaining(["title", "description", "photoIds", "categoryId", "meetupLocation", "availability.0"]),
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

describe("parsePostEdit", () => {
  it("ignores an attempt to change the kind", () => {
    const result = parsePostEdit(valid({ kind: "wishlist" }), lookup, now);
    expect(result.ok && "kind" in result.data).toBe(false);
  });
});

describe("Manila time", () => {
  it("round-trips a datetime-local value", () => {
    const date = fromManilaLocal("2026-12-31T23:30");
    expect(date?.toISOString()).toBe("2026-12-31T15:30:00.000Z");
    expect(toManilaLocal(date!)).toBe("2026-12-31T23:30");
  });

  it.each(["", "2026-12-31", "2026-13-01T10:00", "tomorrow"])("rejects %j", (value) => {
    expect(fromManilaLocal(value)).toBeNull();
  });
});
