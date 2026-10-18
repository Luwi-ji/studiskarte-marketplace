import { and, eq, inArray, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { block, deal, follow, image, student } from "@/db/schema";
import { getDb, type Executor } from "@/lib/db";
import { ACTIVE_STATUSES, syncAvailability } from "@/lib/deals/capacity";
import { lockDeal, touched } from "@/lib/deals/lock";
import { noticeDetail } from "@/lib/deals/notice-detail";
import { isSecured } from "@/lib/deals/slot";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

/**
 * SQL that is true when either of the two has blocked the other. Each side is a
 * column or a student id. Used inside queries, so nothing about a blocked pair
 * is ever read.
 */
export function blockedEitherWaySql(a: SQL | AnyColumn | string, b: SQL | AnyColumn | string): SQL {
  return sql`exists (select 1 from ${block} where (${block.blockerId} = ${a} and ${block.blockedId} = ${b}) or (${block.blockerId} = ${b} and ${block.blockedId} = ${a}))`;
}

/** Whether either of the two students has blocked the other. Pass a transaction to read inside it. */
export async function isBlockedEitherWay(a: string, b: string, executor: Executor = getDb()): Promise<boolean> {
  const rows = await executor
    .select({ blockerId: block.blockerId })
    .from(block)
    .where(or(and(eq(block.blockerId, a), eq(block.blockedId, b)), and(eq(block.blockerId, b), eq(block.blockedId, a))))
    .limit(1);
  return rows.length > 0;
}

/**
 * Blocks a student, privately and for both sides. Everything happens in one
 * transaction: the block is stored (blocking twice is the same as once), the
 * two stop following each other, and every reservation between them that is
 * still being arranged and not secured (nothing paid, no cash in person agreed,
 * no handover confirmed) is cancelled by the system and its units go back to
 * the post. Only the blocked person is told of those, with the usual
 * cancellation notice; the blocker is never alerted about their own action. A
 * secured reservation is left alone, to finish or be reported as usual.
 */
export async function blockStudent(blockerId: string, handle: string, alert?: AlertSink): Promise<"ok" | "self" | "not_found"> {
  const clean = handle.trim().replace(/^@/, "").toLowerCase();
  const alerts: string[] = [];

  const result = await getDb().transaction(async (tx): Promise<"ok" | "self" | "not_found"> => {
    const [target] = await tx
      .select({ id: student.id })
      .from(student)
      .where(and(eq(student.handle, clean), eq(student.accountStatus, "active")));
    if (!target) return "not_found";
    if (target.id === blockerId) return "self";

    await tx.insert(block).values({ blockerId, blockedId: target.id }).onConflictDoNothing();
    await tx
      .delete(follow)
      .where(
        or(
          and(eq(follow.followerId, blockerId), eq(follow.followeeId, target.id)),
          and(eq(follow.followerId, target.id), eq(follow.followeeId, blockerId)),
        ),
      );

    const now = new Date();
    const open = await tx
      .select({ id: deal.id })
      .from(deal)
      .where(
        and(
          inArray(deal.status, [...ACTIVE_STATUSES]),
          or(
            and(eq(deal.ownerId, blockerId), eq(deal.responderId, target.id)),
            and(eq(deal.ownerId, target.id), eq(deal.responderId, blockerId)),
          ),
        ),
      );
    for (const { id } of open) {
      const found = await lockDeal(tx, id);
      // Re-checked under the lock: it may have been completed, cancelled or secured meanwhile.
      if (!found || !ACTIVE_STATUSES.some((status) => status === found.status) || isSecured(found)) continue;
      await tx.update(deal).set({ status: "cancelled", ...touched(now) }).where(eq(deal.id, id));
      await syncAvailability(tx, found.postId, now);
      const recorded = await recordNotification(tx, {
        type: "deal_cancelled",
        recipientId: target.id,
        postId: found.postId,
        conversationId: found.conversationId,
        onceKey: `deal:${id}:cancelled`,
        detail: noticeDetail(found, "deal_cancelled"),
      });
      if (recorded?.alert) alerts.push(recorded.id);
    }
    return "ok";
  });

  if (result === "ok") for (const id of alerts) alert?.(id);
  return result;
}

/** Removes the student's own block. Safe when there was none, or no such handle. */
export async function unblockStudent(blockerId: string, handle: string): Promise<void> {
  const clean = handle.trim().replace(/^@/, "").toLowerCase();
  const db = getDb();
  const [target] = await db.select({ id: student.id }).from(student).where(eq(student.handle, clean));
  if (!target) return;
  await db.delete(block).where(and(eq(block.blockerId, blockerId), eq(block.blockedId, target.id)));
}

/** The students this student has blocked: active ones with a handle, most recently blocked first. */
export async function listBlocked(
  blockerId: string,
): Promise<{ id: string; handle: string; displayName: string; avatarThumbKey: string | null }[]> {
  const rows = await getDb()
    .select({ id: student.id, handle: student.handle, displayName: student.name, avatarThumbKey: image.thumbKey })
    .from(block)
    .innerJoin(student, eq(student.id, block.blockedId))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(and(eq(block.blockerId, blockerId), eq(student.accountStatus, "active"), sql`${student.handle} is not null`))
    .orderBy(sql`${block.createdAt} desc`, student.handle);
  return rows.flatMap((row) => (row.handle ? [{ id: row.id, handle: row.handle, displayName: row.displayName, avatarThumbKey: row.avatarThumbKey }] : []));
}
