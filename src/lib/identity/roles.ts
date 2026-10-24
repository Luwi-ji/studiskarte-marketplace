/** What a person with a verified school email can be. A guest (stored as "visitor") has no school email. */
export const SCHOOL_ROLES = ["student", "faculty", "staff", "alumni"] as const;
export type SchoolRole = (typeof SCHOOL_ROLES)[number];
export type Role = SchoolRole | "visitor";

/** Shown where a school name would be, for an account with no school email. */
export const NO_SCHOOL_LABEL = "Guest";

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  faculty: "Faculty or teacher",
  staff: "Staff",
  alumni: "Alumni",
  visitor: "Guest",
};

export function parseSchoolRole(raw: unknown): SchoolRole | null {
  return SCHOOL_ROLES.find((role) => role === raw) ?? null;
}
