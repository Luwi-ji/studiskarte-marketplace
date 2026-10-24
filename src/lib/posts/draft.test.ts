import { describe, expect, it } from "vitest";
import type { PostFormValues } from "@/app/posts/post-form";
import { DRAFT_MAX_AGE_MS, draftKey, parseDraft, savedAgo, serializeDraft } from "./draft";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const values: PostFormValues = {
  title: "Casio fx-991ES",
  description: "",
  categoryId: "electronics",
  condition: "used_good",
  priceKind: "amount",
  priceAmount: "450",
  quantity: "1",
  unlimited: false,
  exchangeMeetup: true,
  exchangeDelivery: false,
  meetupLocation: "Main gate",
  paymentCash: true,
  paymentOnline: false,
  paymentOther: false,
  paymentNote: "",
  allowNonStudents: false,
  availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "17:00" }],
  photos: [{ id: "6f1c1d5e-1f0b-4a3e-9d0e-0a1b2c3d4e5f", thumbUrl: "https://files.example/t.jpg", caption: "Front" }],
};

describe("draft", () => {
  it("keys a draft by student and kind, with anon when nobody is signed in", () => {
    expect(draftKey("abc", "showcase")).toBe("studiskarte:draft:abc:showcase");
    expect(draftKey(null, "wishlist")).toBe("studiskarte:draft:anon:wishlist");
  });

  it("round-trips the form values, photos included", () => {
    const saved = parseDraft(serializeDraft("showcase", values, NOW - 5 * MINUTE), "showcase", NOW);
    expect(saved).toEqual({ savedAt: NOW - 5 * MINUTE, values });
  });

  it("offers a draft up to 14 days old and no longer", () => {
    expect(parseDraft(serializeDraft("showcase", values, NOW - DRAFT_MAX_AGE_MS), "showcase", NOW)).not.toBeNull();
    expect(parseDraft(serializeDraft("showcase", values, NOW - DRAFT_MAX_AGE_MS - 1), "showcase", NOW)).toBeNull();
  });

  it("treats a save time in the future as now", () => {
    expect(parseDraft(serializeDraft("showcase", values, NOW + DAY), "showcase", NOW)?.savedAt).toBe(NOW);
  });

  it("ignores a draft of the other kind, another version, or that is not JSON", () => {
    expect(parseDraft(serializeDraft("showcase", values, NOW), "wishlist", NOW)).toBeNull();
    expect(parseDraft(serializeDraft("showcase", values, NOW).replace('"version":1', '"version":0'), "showcase", NOW)).toBeNull();
    expect(parseDraft("{nope", "showcase", NOW)).toBeNull();
    expect(parseDraft("null", "showcase", NOW)).toBeNull();
    expect(parseDraft(null, "showcase", NOW)).toBeNull();
    expect(parseDraft("", "showcase", NOW)).toBeNull();
  });

  it("ignores a draft with a value of the wrong type or a broken photo", () => {
    const wrong = (patch: Record<string, unknown>) => JSON.stringify({ version: 1, kind: "showcase", savedAt: NOW, values: { ...values, ...patch } });
    expect(parseDraft(wrong({ title: 5 }), "showcase", NOW)).toBeNull();
    expect(parseDraft(wrong({ unlimited: "yes" }), "showcase", NOW)).toBeNull();
    expect(parseDraft(wrong({ priceKind: "negotiable" }), "showcase", NOW)).toBeNull();
    expect(parseDraft(wrong({ photos: [{ id: "x" }] }), "showcase", NOW)).toBeNull();
    expect(parseDraft(wrong({ availability: [{ kind: "monthly" }] }), "showcase", NOW)).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 1, kind: "showcase", savedAt: "today", values }), "showcase", NOW)).toBeNull();
  });

  it("keeps the fields it has and drops unknown ones, and an empty draft is nothing", () => {
    const partial = JSON.stringify({ version: 1, kind: "showcase", savedAt: NOW, values: { title: "Desk", extra: 1 } });
    expect(parseDraft(partial, "showcase", NOW)?.values).toEqual({ title: "Desk" });
    expect(parseDraft(JSON.stringify({ version: 1, kind: "showcase", savedAt: NOW, values: {} }), "showcase", NOW)).toBeNull();
  });

  it("says how long ago in plain words", () => {
    expect(savedAgo(NOW - 20 * 1000, NOW)).toBe("just now");
    expect(savedAgo(NOW - MINUTE, NOW)).toBe("1 minute ago");
    expect(savedAgo(NOW - 45 * MINUTE, NOW)).toBe("45 minutes ago");
    expect(savedAgo(NOW - 60 * MINUTE, NOW)).toBe("1 hour ago");
    expect(savedAgo(NOW - 5 * 60 * MINUTE, NOW)).toBe("5 hours ago");
    expect(savedAgo(NOW - DAY, NOW)).toBe("yesterday");
    expect(savedAgo(NOW - 3 * DAY, NOW)).toBe("3 days ago");
  });
});
