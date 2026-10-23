import { describe, expect, it } from "vitest";
import { isShareable, sharePrice } from "@/lib/posts/share-card";

describe("sharePrice", () => {
  it("calls a wishlist amount a budget", () => {
    expect(sharePrice("wishlist", "amount", 500)).toBe("Budget ₱500");
  });
  it("shows a showcase amount, free and negotiable as the post page does", () => {
    expect(sharePrice("showcase", "amount", 1200)).toBe("₱1,200");
    expect(sharePrice("showcase", "free", null)).toBe("Free");
    expect(sharePrice("wishlist", "negotiable", null)).toBe("Negotiable");
  });
});

describe("isShareable", () => {
  const now = new Date("2026-10-23T00:00:00Z");
  const later = new Date("2026-11-01T00:00:00Z");
  const earlier = new Date("2026-10-01T00:00:00Z");

  it("shares open posts that have not expired, and reserved ones", () => {
    expect(isShareable("open", later, now)).toBe(true);
    expect(isShareable("reserved", earlier, now)).toBe(true);
  });
  it("never shares withdrawn, hidden, removed, fulfilled or expired posts", () => {
    for (const status of ["withdrawn", "hidden", "removed", "fulfilled", "expired"]) expect(isShareable(status, later, now)).toBe(false);
    expect(isShareable("open", earlier, now)).toBe(false);
  });
});
