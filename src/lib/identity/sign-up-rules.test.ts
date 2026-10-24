import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/identity/roles";
import { PERSONAL_EMAIL_CLOSED, signUpRoleProblem, STUDENT_NEEDS_SCHOOL_EMAIL } from "./sign-up-rules";

const roles: Role[] = ["student", "faculty", "staff", "alumni", "visitor"];

describe("signUpRoleProblem", () => {
  it("lets every role sign up with a school email", () => {
    for (const role of roles) expect(signUpRoleProblem({ role, school: true, personalEmailOpen: false })).toBeNull();
  });

  it("never lets a student use a personal email, even when personal sign-up is open", () => {
    expect(signUpRoleProblem({ role: "student", school: false, personalEmailOpen: true })).toBe(STUDENT_NEEDS_SCHOOL_EMAIL);
  });

  it("lets faculty, staff, alumni and guests use a personal email only while it is open", () => {
    for (const role of roles.filter((r) => r !== "student")) {
      expect(signUpRoleProblem({ role, school: false, personalEmailOpen: true })).toBeNull();
      expect(signUpRoleProblem({ role, school: false, personalEmailOpen: false })).toBe(PERSONAL_EMAIL_CLOSED);
    }
  });
});
