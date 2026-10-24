import type { Role } from "@/lib/identity/roles";

export const STUDENT_NEEDS_SCHOOL_EMAIL = "Students sign up with a school email ending in .edu.ph. If you do not have one, choose another role.";
export const PERSONAL_EMAIL_CLOSED = "Sign-up with a personal email is not open yet. Use your school email.";

/**
 * Whether this role may sign up with this address, as the reason to show or null. A student needs a school email.
 * Faculty, staff, alumni and guests may use either; a personal email is open only while ALLOW_VISITORS is on.
 */
export function signUpRoleProblem(args: { role: Role; school: boolean; personalEmailOpen: boolean }): string | null {
  if (args.school) return null;
  if (args.role === "student") return STUDENT_NEEDS_SCHOOL_EMAIL;
  return args.personalEmailOpen ? null : PERSONAL_EMAIL_CLOSED;
}
