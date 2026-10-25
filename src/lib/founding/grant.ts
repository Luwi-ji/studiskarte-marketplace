import { and, eq, isNull, sql } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { FOUNDING_LIMIT, FOUNDING_LOCK_KEY, FOUNDING_OPENS_AT } from "@/lib/founding/config";

/**
 * Gives the Founding User badge to a member who has just finished sign-up, while places remain. Any role counts
 * (student, faculty, staff, alumni, guest), on or after FOUNDING_OPENS_AT.
 * The lock makes the count and the grant one step, so two sign-ups at once cannot take the last place twice.
 * Never blocks sign-up: a failure is logged.
 */
export async function grantFoundingUser(memberId: string, now = new Date(), limit = FOUNDING_LIMIT): Promise<boolean> {
  if (now < FOUNDING_OPENS_AT) return false;
  try {
    return await getDb().transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${FOUNDING_LOCK_KEY})`);
      const granted = await tx
        .update(student)
        .set({ foundingUserAt: now })
        .where(
          and(
            eq(student.id, memberId),
            eq(student.accountStatus, "active"),
            isNull(student.foundingUserAt),
            sql`(select count(*) from ${student} where ${student.foundingUserAt} is not null) < ${limit}`,
          ),
        )
        .returning({ id: student.id });
      return granted.length > 0;
    });
  } catch (error) {
    console.error("granting the Founding User badge failed", error);
    return false;
  }
}
