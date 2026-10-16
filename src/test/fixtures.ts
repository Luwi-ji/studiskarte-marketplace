import { eq } from "drizzle-orm";
import { school, student } from "@/db/schema";
import { getDb } from "@/lib/db";

export const TEST_SCHOOL = "testschool.edu.ph";

/** Inserts a verified student (and their school) directly, skipping sign-in. Defaults to the shared test school. */
export async function createTestStudent(
  id: string,
  fields: { handle?: string; name?: string; schoolDomain?: string; accountStatus?: string } = {},
): Promise<{ id: string; email: string }> {
  const db = getDb();
  const domain = fields.schoolDomain ?? TEST_SCHOOL;
  const email = `${id}@${domain}`;
  await db.insert(school).values({ domain }).onConflictDoNothing();
  await db.insert(student).values({
    id,
    email,
    emailVerified: true,
    schoolDomain: domain,
    accountStatus: fields.accountStatus ?? "active",
    handle: fields.handle,
    name: fields.name ?? "",
  });
  return { id, email };
}

export async function deleteTestStudent(id: string): Promise<void> {
  await getDb().delete(student).where(eq(student.id, id));
}
