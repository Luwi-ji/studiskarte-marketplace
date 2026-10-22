import { sql } from "drizzle-orm";
import type { Executor } from "@/lib/db";
import { CHILD_SAFETY_REASON } from "@/lib/safety/report";

/**
 * Whether the account's records must be kept, so the person cannot delete the account (RA 11930 Sec 9(a)(2) asks us to
 * preserve data about a child safety case; the Child Safety Standards promise it). True when the owner placed a hold
 * (`student.legal_hold_at`), or when a child safety report about the person, or about one of their listings, is open or
 * was acted on. A dismissed report holds nothing. Reads only; the reason is never shown to the person.
 */
export async function underLegalHold(db: Executor, studentId: string): Promise<boolean> {
  const result = await db.execute<{ held: boolean }>(sql`
    select (
      exists (select 1 from student s where s.id = ${studentId} and s.legal_hold_at is not null)
      or exists (
        select 1 from report r
         where r.reason = ${CHILD_SAFETY_REASON}
           and r.status in ('open', 'actioned')
           and (r.student_id = ${studentId} or r.post_id in (select p.id from post p where p.owner_id = ${studentId}))
      )
    ) as held
  `);
  return result.rows[0].held;
}
