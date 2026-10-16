import { and, eq, sql, type SQL } from "drizzle-orm";
import { post, student } from "@/db/schema";

/**
 * The one rule for which posts other students may see (feed, profiles, hearted
 * list, post page, views, hearts): the post is reserved, or open with its 30
 * days not yet passed, and its owner's account is active. The expiry test is
 * here as well as in the expiry job, so a post leaves every list the moment it
 * expires, not when the job next runs. The query must join `student` on the
 * post's owner. Blocking (Phase 14) is added here.
 */
export function visibleToOthers(): SQL {
  return and(
    sql`(${post.status} = 'reserved' or (${post.status} = 'open' and ${post.expiresAt} > now()))`,
    eq(student.accountStatus, "active"),
  ) as SQL;
}
