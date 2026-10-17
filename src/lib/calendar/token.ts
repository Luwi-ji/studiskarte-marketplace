import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";

/** SHA-256 as 64 lowercase hex characters. Only this is stored, never the token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Makes a new private calendar link token (43 URL-safe characters) and stores
 * its hash. A student has one link: making another stops the old one at once.
 * The token is returned here and nowhere else.
 */
export async function createCalendarToken(studentId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await getDb()
    .update(student)
    .set({ calendarTokenHash: hashToken(token), updatedAt: sql`now()` })
    .where(eq(student.id, studentId));
  return token;
}

/** Turns the link off. */
export async function revokeCalendarToken(studentId: string): Promise<void> {
  await getDb()
    .update(student)
    .set({ calendarTokenHash: null, updatedAt: sql`now()` })
    .where(eq(student.id, studentId));
}

export async function hasCalendarToken(studentId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ hash: student.calendarTokenHash })
    .from(student)
    .where(eq(student.id, studentId));
  return row?.hash != null;
}
