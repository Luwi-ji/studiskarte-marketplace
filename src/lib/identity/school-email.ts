// The one place that decides whether an address may join.
// Pure: no I/O, so it is cheap to test exhaustively.

const SCHOOL_SUFFIX = ".edu.ph";

// Deliberately strict: one "@", a plain local part, and a dotted domain of
// letters, digits and hyphens. Quoted local parts and IP-literal domains are
// refused; no school mailbox needs them.
const ADDRESS = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;

export type SchoolEmail = { email: string; domain: string };

/**
 * Returns the trimmed, lowercased address and its domain when the address
 * belongs to a Philippine school (domain ends with `.edu.ph` and has at least
 * one label before it). Returns null otherwise.
 */
export function parseSchoolEmail(raw: string): SchoolEmail | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  const match = ADDRESS.exec(email);
  if (!match) return null;
  const domain = match[1];
  if (!domain.endsWith(SCHOOL_SUFFIX)) return null;
  // "edu.ph" alone and "x@.edu.ph" must not pass.
  const labels = domain.slice(0, -SCHOOL_SUFFIX.length).split(".");
  if (labels.some((label) => label === "")) return null;
  return { email, domain };
}
