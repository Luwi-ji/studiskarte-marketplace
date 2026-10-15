import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { auth } from "@/lib/identity/auth";

export type ActiveStudent = { id: string; schoolDomain: string };

/**
 * The student behind a request's session, or null. Suspended and deleted
 * accounts count as signed out. Reads the request, so call it inside a
 * Suspense boundary (Cache Components).
 */
export async function getActiveStudent(requestHeaders?: Headers): Promise<ActiveStudent | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!session) return null;
  const [row] = await getDb()
    .select({ id: student.id, schoolDomain: student.schoolDomain, accountStatus: student.accountStatus })
    .from(student)
    .where(eq(student.id, session.user.id));
  if (!row || row.accountStatus !== "active") return null;
  return { id: row.id, schoolDomain: row.schoolDomain };
}

/** For pages: sends visitors to sign in. Every signed-in page starts here. */
export async function requireActiveStudent(): Promise<ActiveStudent> {
  const current = await getActiveStudent();
  if (!current) redirect("/sign-in");
  return current;
}
