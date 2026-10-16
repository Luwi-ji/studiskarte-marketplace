import { sql, type SQL } from "drizzle-orm";
import { post } from "@/db/schema";

/**
 * Posts other students may see: reserved posts, and open posts whose 30 days
 * have not passed. The expiry test is here as well as in the expiry job, so a
 * post leaves the feed the moment it expires, not when the job next runs.
 * (Phase 6 makes this the single base query for the feed, search and profiles.)
 */
export function liveForOthers(): SQL {
  return sql`(${post.status} = 'reserved' or (${post.status} = 'open' and ${post.expiresAt} > now()))`;
}
