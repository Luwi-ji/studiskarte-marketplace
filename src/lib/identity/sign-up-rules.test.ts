import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/identity/roles";
import { needsSchoolEmail, PERSONAL_EMAIL_CLOSED, signUpRoleProblem } from "./sign-up-rules";

const roles: Role[] = ["student", "faculty", "staff", "alumni", "visitor"];
const schoolRoles = roles.filter((role) => role !== "visitor");

describe("signUpRoleProblem", () => {
  it("lets every role sign up with a school email", () => {
    for (const role of roles) expect(signUpRoleProblem({ role, school: true, personalEmailOpen: false })).toBeNull();
  });

  it("never lets a student, faculty, staff or alumni use a personal email, even when personal sign-up is open", () => {
    for (const role of schoolRoles) {
      expect(signUpRoleProblem({ role, school: false, personalEmailOpen: true })).toBe(needsSchoolEmail(role));
      expect(signUpRoleProblem({ role, school: false, personalEmailOpen: false })).toBe(needsSchoolEmail(role));
    }
  });

  it("names the role in the reason and points to Guest", () => {
    expect(needsSchoolEmail("student")).toMatch(/^Students sign up with a school email/);
    expect(needsSchoolEmail("faculty")).toMatch(/^Faculty or teacher accounts sign up with a school email/);
    expect(needsSchoolEmail("alumni")).toMatch(/Choose Guest\.$/);
  });

  it("lets a guest use a personal email only while it is open", () => {
    expect(signUpRoleProblem({ role: "visitor", school: false, personalEmailOpen: true })).toBeNull();
    expect(signUpRoleProblem({ role: "visitor", school: false, personalEmailOpen: false })).toBe(PERSONAL_EMAIL_CLOSED);
  });
});
