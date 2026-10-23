import { describe, expect, it } from "vitest";
import { shortSchool } from "./cards";

describe("shortSchool", () => {
  it("uses the abbreviation an admin set, trimmed", () => {
    expect(shortSchool("Technological University of the Philippines Manila", "  TUP-M ")).toBe("TUP-M");
  });

  it("works out initials from the capital letters when no abbreviation is set", () => {
    expect(shortSchool("University of the Philippines Diliman", null)).toBe("UPD");
    expect(shortSchool("Technological University of the Philippines", "   ")).toBe("TUP");
  });

  it("falls back to the name when it cannot be abbreviated", () => {
    expect(shortSchool("polytechnic", null)).toBe("polytechnic");
    expect(shortSchool("pup.edu.ph", null)).toBe("pup.edu.ph");
    expect(shortSchool("Ateneo", null)).toBe("Ateneo");
  });
});
