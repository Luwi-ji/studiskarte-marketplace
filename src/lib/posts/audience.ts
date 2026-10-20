import type { Role } from "@/lib/identity/roles";

export const STUDENTS_ONLY = "This listing is for students only.";
export const SHOWCASE_STUDENTS_ONLY = "Only students can post a showcase. You can post a wishlist instead.";

/**
 * Whether this person may message, make an offer on or reserve a post. Students always may. Everyone
 * else (faculty, staff, alumni, visitors) only on a showcase whose seller allowed non-students: they
 * cannot sell, so a Wishlist is not theirs to answer. Returns the reason to show, or null.
 */
export function audienceRefusal(args: { role: Role; kind: string; allowNonStudents: boolean }): string | null {
  if (args.role === "student") return null;
  return args.kind === "showcase" && args.allowNonStudents ? null : STUDENTS_ONLY;
}
