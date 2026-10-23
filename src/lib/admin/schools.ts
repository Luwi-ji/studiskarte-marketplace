import { asc, eq } from "drizzle-orm";
import { school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { shortSchool } from "@/lib/discovery/cards";

export const SHORT_NAME_MAX = 12;
const NOT_ADMIN = "Only an admin can do this.";
const NO_SUCH_SCHOOL = "That school could not be found.";

export type SchoolRow = {
  domain: string;
  /** The full name, or the domain until the owner names it. */
  name: string;
  /** What an admin set; null until then. */
  shortName: string | null;
  /** What cards show now: the admin's value, else initials worked out from the name. */
  shown: string;
};

/** Every school, by domain. */
export async function listSchools(): Promise<SchoolRow[]> {
  const rows = await getDb().select({ domain: school.domain, name: school.name, shortName: school.shortName }).from(school).orderBy(asc(school.domain));
  return rows.map((row) => {
    const name = row.name ?? row.domain;
    return { domain: row.domain, name, shortName: row.shortName, shown: shortSchool(name, row.shortName) };
  });
}

/** The abbreviation as stored: trimmed, null when empty. Returns an error message when it cannot be used. */
export function parseShortName(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Write the abbreviation as text." };
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  if (Array.from(text).length > SHORT_NAME_MAX) return { ok: false, error: `Use at most ${SHORT_NAME_MAX} characters.` };
  if (/[\u0000-\u001f\u007f]/.test(text)) return { ok: false, error: "Use letters, numbers, spaces and dashes only." };
  return { ok: true, value: text };
}

/** Sets or clears one school's abbreviation. The admin flag is read from the database here, not trusted from the caller. */
export async function setSchoolShortName(adminId: string, domain: string, raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = parseShortName(raw);
  if (!parsed.ok) return parsed;
  const db = getDb();
  const [admin] = await db.select({ isAdmin: student.isAdmin, status: student.accountStatus }).from(student).where(eq(student.id, adminId));
  if (admin?.isAdmin !== true || admin.status !== "active") return { ok: false, error: NOT_ADMIN };
  const updated = await db.update(school).set({ shortName: parsed.value }).where(eq(school.domain, domain)).returning({ domain: school.domain });
  return updated.length === 0 ? { ok: false, error: NO_SUCH_SCHOOL } : { ok: true };
}
