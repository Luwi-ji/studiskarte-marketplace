import { and, eq, isNull, sql } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { FOUNDING_LIMIT, FOUNDING_LOCK_KEY, FOUNDING_OPENS_AT } from "@/lib/founding/config";

/**
 * Gives the Founding Seller badge to a student who has just finished sign-up, while places remain.
 * Only students (not faculty, staff, alumni or guests, who cannot sell) on or after FOUNDING_OPENS_AT.
 * The lock makes the count and the grant one step, so two sign-ups at once cannot take the last place twice.
 * Never blocks sign-up: a failure is logged.
 */
export async function grantFoundingSeller(studentId: string, now = new Date(), limit = FOUNDING_LIMIT): Promise<boolean> {
  if (now < FOUNDING_OPENS_AT) return false;
  try {
    return await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${FOUNDING_LOCK_KEY})`);
      const granted = await tx
        .update(student)
        .set({ foundingSellerAt: now })
        .where(
          and(
            eq(student.id, studentId),
            eq(student.role, "student"),
            eq(student.accountStatus, "active"),
            isNull(student.foundingSellerAt),
            sql`(select count(*) from ${student} where ${student.foundingSellerAt} is not null) < ${limit}`,
          ),
        )
        .returning({ id: student.id });
      return granted.length > 0;
    });
  } catch (error) {
    console.error("granting the Founding Seller badge failed", error);
    return false;
  }
}
