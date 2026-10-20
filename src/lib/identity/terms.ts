import { and, eq } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { currentLegal } from "@/lib/legal/documents";

export type AcceptResult = { ok: true } | { ok: false; error: string };

export const NOTHING_TO_ACCEPT = "There is nothing to accept right now.";
export const TERMS_CHANGED = "The terms just changed. Reload the page and read them again.";
/** Studiskarte Marketplace is for adults only (decided 2026-10-21); the confirmation is stored with the terms acceptance. */
export const AGE_REQUIRED = "You must be 18 or older to use Studiskarte Marketplace. If you are younger, please do not sign up.";

/**
 * Records that an active student accepted the legal documents they were shown and confirmed they are 18
 * or older. `shownVersion` is the version on their screen: if the documents were updated meanwhile,
 * nothing is recorded, so nobody accepts text they did not see.
 */
export async function acceptTerms(studentId: string, shownVersion: string, adult: boolean, now = new Date()): Promise<AcceptResult> {
  const legal = currentLegal();
  if (!legal) return { ok: false, error: NOTHING_TO_ACCEPT };
  if (legal.version !== shownVersion) return { ok: false, error: TERMS_CHANGED };
  if (!adult) return { ok: false, error: AGE_REQUIRED };
  await getDb()
    .update(student)
    .set({ termsVersion: legal.version, termsAcceptedAt: now, adultConfirmedAt: now, updatedAt: now })
    .where(and(eq(student.id, studentId), eq(student.accountStatus, "active")));
  return { ok: true };
}
