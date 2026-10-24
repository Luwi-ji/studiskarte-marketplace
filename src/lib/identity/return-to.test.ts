import { describe, expect, it } from "vitest";
import { safeReturnTo, withReturnTo } from "./return-to";

const ID = "123e4567-e89b-42d3-a456-426614174000";

describe("return-to", () => {
  it("keeps a listing path and drops everything else", () => {
    expect(safeReturnTo(`/posts/${ID}`)).toBe(`/posts/${ID}`);
    for (const bad of ["//evil.com", "https://evil.com", "/posts/x", `/posts/${ID}/../x`, "/", null, 5]) {
      expect(safeReturnTo(bad)).toBeNull();
    }
  });

  it("adds next to a step only when it is safe", () => {
    expect(withReturnTo("/welcome", `/posts/${ID}`)).toBe(`/welcome?next=${encodeURIComponent(`/posts/${ID}`)}`);
    expect(withReturnTo("/welcome", "//evil.com")).toBe("/welcome");
  });
});
