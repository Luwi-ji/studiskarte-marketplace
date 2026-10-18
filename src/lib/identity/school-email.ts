// The one place that decides whether an address may join.
// Pure: no I/O, so it is cheap to test exhaustively.

const SCHOOL_SUFFIX = ".edu.ph";

// Deliberately strict: one "@", a local part of letters, digits, dots, underscores
// and hyphens, and a dotted domain of letters, digits and hyphens. No "+tag": a tag
// would let one mailbox make unlimited accounts (and escape a suspension). No "%" or
// "!" either: some mail servers read them as routing to another domain. Quoted local
// parts and IP-literal domains are refused too; no school mailbox needs them.
const ADDRESS = /^[a-z0-9._-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/;

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

export type ParsedEmail = { email: string; domain: string; school: boolean };

/**
 * Any address that passes the same strict shape (see ADDRESS), school or not.
 * `school` is true for a Philippine school address. Visitors sign up with the
 * ones where it is false.
 */
export function parseEmail(raw: string): ParsedEmail | null {
  const email = raw.trim().toLowerCase();
  if (email.length > 254) return null;
  const match = ADDRESS.exec(email);
  if (!match) return null;
  return { email, domain: match[1], school: parseSchoolEmail(email) !== null };
}
