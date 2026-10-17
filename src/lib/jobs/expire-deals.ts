import { and, eq, lte, or } from "drizzle-orm";
import { deal } from "@/db/schema";
import { getDb } from "@/lib/db";
import { syncAvailability } from "@/lib/deals/capacity";
import { CONFIRM_IDLE_DAYS, SCHEDULE_IDLE_DAYS } from "@/lib/deals/handover";
import { lockDeal } from "@/lib/deals/lock";
import { isSecured } from "@/lib/deals/slot";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

const DAY_MS = 86_400_000;

/**
 * Closes reservations nobody carried out: one not scheduled within 7 days of
 * being accepted, or one not completed within 7 days after its time. An
 * unsecured one is cancelled. A secured one (paid, or cash in person agreed)
 * cannot be cancelled, so it becomes "disputed" for a look instead. Either way
 * the units go back to the post (reopened with at least a week left), both
 * people are told once, and no count or review results. Safe to run twice: a
 * second run finds nothing active and idle.
 */
export async function expireDeals(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  const idle = await db
    .select({ id: deal.id })
    .from(deal)
    .where(
      or(
        and(eq(deal.status, "agreed"), lte(deal.createdAt, new Date(now.getTime() - SCHEDULE_IDLE_DAYS * DAY_MS))),
        and(eq(deal.status, "scheduled"), lte(deal.scheduledAt, new Date(now.getTime() - CONFIRM_IDLE_DAYS * DAY_MS))),
      ),
    );

  let cancelled = 0;
  for (const { id } of idle) {
    const told = await db.transaction(async (tx) => {
      const found = await lockDeal(tx, id);
      // Re-checked under the lock: it may have been scheduled, completed or cancelled meanwhile.
      const stale =
        found &&
        ((found.status === "agreed" && found.createdAt.getTime() <= now.getTime() - SCHEDULE_IDLE_DAYS * DAY_MS) ||
          (found.status === "scheduled" && found.scheduledAt !== null && found.scheduledAt.getTime() <= now.getTime() - CONFIRM_IDLE_DAYS * DAY_MS));
      if (!found || !stale) return [];
      const secured = isSecured(found);
      await tx.update(deal).set({ status: secured ? "disputed" : "cancelled", updatedAt: now }).where(eq(deal.id, id));
      await syncAvailability(tx, found.postId, now);
      const notices = [];
      for (const recipientId of [found.ownerId, found.responderId]) {
        notices.push(
          await recordNotification(tx, {
            type: secured ? "deal_disputed" : "deal_expired",
            recipientId,
            postId: found.postId,
            conversationId: found.conversationId,
            onceKey: `deal:${id}:${secured ? "disputed" : "expired"}`,
          }),
        );
      }
      return notices;
    });
    if (told.length > 0) cancelled += 1;
    for (const notice of told) if (notice?.alert) alert?.(notice.id);
  }
  return cancelled;
}
