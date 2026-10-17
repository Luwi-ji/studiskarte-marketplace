import { describe, expect, it } from "vitest";
import { noteTemplate } from "./note-template";

describe("noteTemplate", () => {
  it("starts a reservation on a showcase with what the student wants", () => {
    expect(noteTemplate("showcase", "reserve", "")).toBe("I want this.");
  });

  it("names the typed amount in an offer, and a plain phrase until there is one", () => {
    expect(noteTemplate("showcase", "offer", "")).toBe("I want this for my offered price.");
    expect(noteTemplate("showcase", "offer", "1200")).toBe("I want this for ₱1,200.");
  });

  it("answers a wishlist as the one who has the item", () => {
    expect(noteTemplate("wishlist", "reserve", "")).toBe("I have this. Do you want to see it?");
    expect(noteTemplate("wishlist", "offer", "")).toBe("I have this for my price.");
    expect(noteTemplate("wishlist", "offer", "450")).toBe("I have this for ₱450.");
  });
});
