import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** What is waiting for the owner right now, for the top of the admin overview. */
export type Attention = {
  /** Open child safety reports: the first thing to read. */
  childSafetyReports: number;
  /** Open reports of any other reason (about posts and about people). */
  otherReports: number;
  /** Posts hidden and waiting for a decision. */
  hiddenPosts: number;
  /** ID checks sent in and waiting. */
  pendingIdChecks: number;
  /** Reservations with a problem report that are not over. */
  dealProblems: number;
};

type Row = { child_safety: number; other: number; hidden: number; id_checks: number; deals: number };

export async function getAttention(): Promise<Attention> {
  const result = await getDb().execute<Row>(sql`
    select
      (select count(*)::int from report where status = 'open' and reason = 'child_safety') as child_safety,
      (select count(*)::int from report where status = 'open' and reason <> 'child_safety') as other,
      (select count(*)::int from post where status = 'hidden') as hidden,
      (select count(*)::int from id_verification where status = 'pending') as id_checks,
      (select count(distinct d.id)::int from deal d join deal_report dr on dr.deal_id = d.id where d.status in ('agreed', 'scheduled', 'disputed')) as deals
  `);
  const row = result.rows[0];
  return { childSafetyReports: row.child_safety, otherReports: row.other, hiddenPosts: row.hidden, pendingIdChecks: row.id_checks, dealProblems: row.deals };
}
