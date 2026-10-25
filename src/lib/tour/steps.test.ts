import { describe, expect, it } from "vitest";
import { tourKindFor, tourSteps } from "./steps";

describe("tour", () => {
  it("segments by role", () => {
    expect(tourKindFor("student")).toBe("student");
    expect(tourKindFor("visitor")).toBe("guest");
    for (const role of ["faculty", "staff", "alumni"] as const) expect(tourKindFor(role)).toBe("member");
  });

  it("ends each tour with the one action that gets that person to a first win", () => {
    const last = (kind: "student" | "member" | "guest") => tourSteps(kind, "Ana").at(-1)?.cta?.href;
    expect(last("student")).toBe("/posts/new/showcase");
    expect(last("member")).toBe("/posts/new/wishlist");
    expect(last("guest")).toBe("/me/settings/school-email");
  });

  it("puts an action on the last step only, and keeps every tour short", () => {
    for (const kind of ["student", "member", "guest"] as const) {
      const steps = tourSteps(kind, "Ana");
      expect(steps.length).toBeLessThanOrEqual(7);
      expect(steps.slice(0, -1).some((step) => step.cta)).toBe(false);
    }
  });

  it("only promises selling to students", () => {
    const sells = (kind: "student" | "member" | "guest") => tourSteps(kind, "Ana").some((step) => step.id === "sell");
    expect(sells("student")).toBe(true);
    expect(sells("member")).toBe(false);
    expect(sells("guest")).toBe(false);
  });

  it("offers the home-screen step to everyone, before the last step", () => {
    for (const kind of ["student", "member", "guest"] as const) {
      const steps = tourSteps(kind, "Ana");
      expect(steps.at(-2)?.id).toBe("install");
    }
  });

  it("greets by first name", () => {
    expect(tourSteps("student", "  Ana Reyes ")[0].title).toBe("Welcome, Ana!");
    expect(tourSteps("student", "")[0].title).toBe("Welcome, there!");
  });
});
