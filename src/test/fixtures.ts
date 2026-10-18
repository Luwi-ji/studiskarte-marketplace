import { eq } from "drizzle-orm";
import { school, student } from "@/db/schema";
import { getDb } from "@/lib/db";

export const TEST_SCHOOL = "testschool.edu.ph";

/**
 * Inserts a verified account (and its school) directly, skipping sign-in. Defaults to a student of the
 * shared test school; `visitor` makes one with a personal address and no school.
 */
export async function createTestStudent(
  id: string,
  fields: { handle?: string; name?: string; schoolDomain?: string; accountStatus?: string; isAdmin?: boolean; visitor?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const db = getDb();
  if (fields.visitor) {
    const email = `${id}@visitor.test`;
    await db.insert(student).values({
      id,
      email,
      emailVerified: true,
      role: "visitor",
      accountStatus: fields.accountStatus ?? "active",
      isAdmin: fields.isAdmin ?? false,
      handle: fields.handle,
      name: fields.name ?? "",
    });
    return { id, email };
  }
  const domain = fields.schoolDomain ?? TEST_SCHOOL;
  const email = `${id}@${domain}`;
  await db.insert(school).values({ domain }).onConflictDoNothing();
  await db.insert(student).values({
    id,
    email,
    emailVerified: true,
    schoolDomain: domain,
    schoolEmail: email,
    role: "student",
    accountStatus: fields.accountStatus ?? "active",
    isAdmin: fields.isAdmin ?? false,
    handle: fields.handle,
    name: fields.name ?? "",
  });
  return { id, email };
}

export async function deleteTestStudent(id: string): Promise<void> {
  await getDb().delete(student).where(eq(student.id, id));
}
