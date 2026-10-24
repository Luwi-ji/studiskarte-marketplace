import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/identity/auth";
import { signInUrl, withReturnTo } from "@/lib/identity/return-to";
import type { Role } from "@/lib/identity/roles";
import { currentLegal, needsTerms } from "@/lib/legal/documents";

/** A signed-in, active account. `handle` is null until sign-up is finished; `schoolDomain` is null for a visitor. */
export type SignedInStudent = { id: string; schoolDomain: string | null; role: Role; handle: string | null; isAdmin: boolean; mustAcceptTerms: boolean };
/** A student who has finished sign-up and may use the app. */
export type ActiveStudent = SignedInStudent & { handle: string };

/**
 * The student behind a request's session, or null. Suspended and deleted
 * accounts count as signed out. Reads the request, so call it inside a
 * Suspense boundary (Cache Components).
 */
export async function getSignedInStudent(requestHeaders?: Headers): Promise<SignedInStudent | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!session) return null;
  const [row] = await getDb()
    .select({
      id: student.id,
      schoolDomain: student.schoolDomain,
      role: student.role,
      handle: student.handle,
      accountStatus: student.accountStatus,
      isAdmin: student.isAdmin,
      termsVersion: student.termsVersion,
      ageConfirmedAt: student.ageConfirmedAt,
    })
    .from(student)
    .where(eq(student.id, session.user.id));
  if (!row || row.accountStatus !== "active") return null;
  return {
    id: row.id,
    schoolDomain: row.schoolDomain,
    role: row.role as Role,
    handle: row.handle,
    isAdmin: row.isAdmin,
    // Asked again when the legal text changed, or when they have never confirmed their age.
    mustAcceptTerms: needsTerms(row.termsVersion, currentLegal()?.version ?? null) || (currentLegal() !== null && row.ageConfirmedAt === null),
  };
}

/** Narrows to a student who has finished sign-up. */
export function hasFinishedSignUp(current: SignedInStudent): current is ActiveStudent {
  return current.handle !== null;
}

/** For pages: visitors go to sign in, students without a handle go to finish sign-up, and a student who has not accepted the current terms is asked to. */
export async function requireActiveStudent(returnTo?: string): Promise<ActiveStudent> {
  const current = await getSignedInStudent();
  if (!current) redirect(signInUrl(returnTo ?? null));
  if (!hasFinishedSignUp(current)) redirect(withReturnTo("/welcome", returnTo));
  if (current.mustAcceptTerms) redirect(withReturnTo("/accept-terms", returnTo));
  return current;
}

/** For admin pages: anyone who is not an admin gets a plain 404, so the pages are not even revealed. */
export async function requireAdmin(): Promise<ActiveStudent> {
  const current = await requireActiveStudent();
  if (!current.isAdmin) notFound();
  return current;
}
