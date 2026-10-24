import { ROLE_LABEL, type Role } from "@/lib/identity/roles";

export const PERSONAL_EMAIL_CLOSED = "Sign-up with a personal email is not open yet. Use your school email.";

/** The reason a role that belongs to a school cannot sign up with a personal email. */
export function needsSchoolEmail(role: Role): string {
  const who = role === "student" ? "Students" : `${ROLE_LABEL[role]} accounts`;
  return `${who} sign up with a school email ending in .edu.ph. No school email? Choose Guest.`;
}

/**
 * Whether this role may sign up with this address, as the reason to show or null. Student, faculty or teacher, staff and
 * alumni belong to a school, so they need a school email. A guest may use either; a personal email is open only while
 * ALLOW_VISITORS is on.
 */
export function signUpRoleProblem(args: { role: Role; school: boolean; personalEmailOpen: boolean }): string | null {
  if (args.school) return null;
  if (args.role !== "visitor") return needsSchoolEmail(args.role);
  return args.personalEmailOpen ? null : PERSONAL_EMAIL_CLOSED;
}
