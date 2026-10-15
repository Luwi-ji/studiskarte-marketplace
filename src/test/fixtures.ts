import { eq } from "drizzle-orm";
import { school, student } from "@/db/schema";
import { getDb } from "@/lib/db";

export const TEST_SCHOOL = "testschool.edu.ph";

/** Inserts a verified student (and their school) directly, skipping sign-in. */
export async function createTestStudent(
  id: string,
  fields: { handle?: string; name?: string } = {},
): Promise<{ id: string; email: string }> {
  const db = getDb();
  const email = `${id}@${TEST_SCHOOL}`;
  await db.insert(school).values({ domain: TEST_SCHOOL }).onConflictDoNothing();
  await db.insert(student).values({
    id,
    email,
    emailVerified: true,
    schoolDomain: TEST_SCHOOL,
    handle: fields.handle,
    name: fields.name ?? "",
  });
  return { id, email };
}

export async function deleteTestStudent(id: string): Promise<void> {
  await getDb().delete(student).where(eq(student.id, id));
}
