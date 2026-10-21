import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export type ModerationCounts = {
  /** Reports nobody has decided yet: about posts and about students. */
  openReports: number;
  /** Posts hidden after reports and waiting for the owner's decision. */
  hiddenPosts: number;
  suspendedAccounts: number;
  deletedAccounts: number;
};

type CountsRow = { open_reports: number; hidden_posts: number; suspended: number; deleted: number };

/** The numbers at the top of the moderation page, in one query. */
export async function getModerationCounts(): Promise<ModerationCounts> {
  const result = await getDb().execute<CountsRow>(sql`
    select
      (select count(*)::int from report where status = 'open') as open_reports,
      (select count(*)::int from post where status = 'hidden') as hidden_posts,
      (select count(*)::int from student where account_status = 'suspended') as suspended,
      (select count(*)::int from student where account_status = 'deleted') as deleted
  `);
  const row = result.rows[0];
  return { openReports: row.open_reports, hiddenPosts: row.hidden_posts, suspendedAccounts: row.suspended, deletedAccounts: row.deleted };
}
