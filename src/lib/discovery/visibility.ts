import { and, eq, sql, type SQL } from "drizzle-orm";
import { post, student } from "@/db/schema";
import { blockedEitherWaySql } from "@/lib/safety/block";

/**
 * The part of the rule that needs no viewer: the post is reserved, or open with its 30 days not yet
 * passed, and its owner's account is active. A hidden, removed, withdrawn, fulfilled or expired post
 * fails the status test; a suspended or deleted owner fails the account test. The expiry test is here
 * as well as in the expiry job, so a post leaves every list the moment it expires, not when the job
 * next runs. The query must join `student` on the post's owner.
 */
export function liveAndActive(): SQL {
  return and(
    sql`(${post.status} = 'reserved' or (${post.status} = 'open' and ${post.expiresAt} > now()))`,
    eq(student.accountStatus, "active"),
  ) as SQL;
}

/**
 * The one rule for which posts a student may see (feed, profiles, hearted
 * list, post page, views, hearts): `liveAndActive`, and neither the viewer
 * nor the owner has blocked the other. The query must join `student` on the
 * post's owner.
 */
export function visibleToOthers(viewerId: string): SQL {
  return and(liveAndActive(), sql`not ${blockedEitherWaySql(viewerId, post.ownerId)}`) as SQL;
}
