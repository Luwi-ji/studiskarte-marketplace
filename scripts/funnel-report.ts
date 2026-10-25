/**
 * Prints how many people reached each funnel stage, and per stage the count by utm_source. Read-only.
 * Run: npx tsx --env-file=.env.local scripts/funnel-report.ts [--since YYYY-MM-DD]
 * Counts are raw: landing views include bots and link prefetches.
 */
import { sql } from "drizzle-orm";
import { getDb, getPool } from "../src/lib/db";
import { FUNNEL_STAGES } from "../src/lib/funnel/events";

const sinceFlag = process.argv.indexOf("--since");
const since = sinceFlag === -1 ? null : process.argv[sinceFlag + 1];
if (sinceFlag !== -1 && !(since && /^\d{4}-\d{2}-\d{2}$/.test(since))) throw new Error("Usage: --since YYYY-MM-DD");

async function main() {
  const db = getDb();
  console.log(`Database: ${process.env.NEON_BRANCH ?? "(NEON_BRANCH not set)"}${since ? `, since ${since}` : ""}`);
  const filter = since ? sql`where e.created_at >= ${since}::date` : sql``;
  const rows = await db.execute<{ stage: string; source: string; n: number }>(sql`
    select e.stage, coalesce(e.utm_source, s.utm_source, '(direct)') as source, count(*)::int as n
    from funnel_event e left join student s on s.id = e.student_id
    ${filter}
    group by 1, 2
    order by n desc`);
  for (const stage of FUNNEL_STAGES) {
    const mine = rows.rows.filter((r) => r.stage === stage);
    console.log(`\n${stage}: ${mine.reduce((sum, r) => sum + r.n, 0)}`);
    for (const r of mine) console.log(`  ${r.source.padEnd(24)} ${r.n}`);
  }
  console.log("\nsignup_started counts email-code sign-ups only; Google sign-ups appear only as signup_completed.");
  console.log(
    "first_* stages record at a student's next action after this was deployed, so older members appear later than they joined; use --since.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .then(() => getPool().end());
