import { describe, expect, it } from "vitest";
import { parseSchoolEmail } from "./school-email";

describe("parseSchoolEmail", () => {
  it.each([
    ["juan@up.edu.ph", "up.edu.ph"],
    ["  Juan.Dela-Cruz@UP.EDU.PH\n", "up.edu.ph"],
    ["a+tag@mail.ateneo.edu.ph", "mail.ateneo.edu.ph"],
  ])("accepts %j", (input, domain) => {
    expect(parseSchoolEmail(input)).toEqual({
      email: input.trim().toLowerCase(),
      domain,
    });
  });

  it.each([
    "juan@up.edu.ph.com",
    "juan@xedu.ph",
    "juan@edu.ph",
    "juan@.edu.ph",
    "juan@up..edu.ph",
    "juan@up.edu.ph@evil.com",
    "juan@evil.com",
    "juan@evil.com?x=.edu.ph",
    "@up.edu.ph",
    "juan up@up.edu.ph",
    '"a@b"@up.edu.ph',
    "",
  ])("rejects %j", (input) => {
    expect(parseSchoolEmail(input)).toBeNull();
  });

  it("rejects overlong addresses", () => {
    expect(parseSchoolEmail(`${"a".repeat(250)}@up.edu.ph`)).toBeNull();
  });
});
