import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/identity/auth";
import { signInUrl, withReturnTo } from "@/lib/identity/return-to";
import { hasRecentAdminMfa, SENSITIVE_MFA_MAX_AGE_SECONDS } from "@/lib/identity/admin-mfa";
import type { Role } from "@/lib/identity/roles";
import { currentLegal, needsTerms } from "@/lib/legal/documents";

/** A signed-in, active account. `handle` is null until sign-up is finished; `schoolDomain` is null for a visitor. */
export type SignedInStudent = { id: string; schoolDomain: string | null; role: Role; handle: string | null; isAdmin: boolean; twoFactorEnabled: boolean; mustAcceptTerms: boolean; tourSeen: boolean };
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
      twoFactorEnabled: student.twoFactorEnabled,
      termsVersion: student.termsVersion,
      ageConfirmedAt: student.ageConfirmedAt,
      tourSeenAt: student.tourSeenAt,
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
    twoFactorEnabled: row.twoFactorEnabled,
    tourSeen: row.tourSeenAt !== null,
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

/** Checks the account's admin flag without requiring MFA. Only the MFA enrollment page may use this guard. */
export async function requireAdminAccount(): Promise<ActiveStudent> {
  const current = await requireActiveStudent();
  if (!current.isAdmin) notFound();
  return current;
}

/** For admin pages: require an enrolled authenticator and a second factor verified in the last 12 hours. */
export async function requireAdmin(): Promise<ActiveStudent> {
  const current = await requireAdminAccount();
  if (!current.twoFactorEnabled) redirect("/admin/security");
  if (!(await hasRecentAdminMfa(current.id))) redirect("/two-factor?next=/admin");
  return current;
}

/** Sensitive decisions require the administrator to verify again within 15 minutes. */
export async function requireRecentAdmin(): Promise<ActiveStudent> {
  const current = await requireAdminAccount();
  if (!current.twoFactorEnabled) redirect("/admin/security");
  if (!(await hasRecentAdminMfa(current.id, SENSITIVE_MFA_MAX_AGE_SECONDS))) redirect("/two-factor?next=/admin");
  return current;
}
