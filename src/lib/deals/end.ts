import { eq } from "drizzle-orm";
import { deal } from "@/db/schema";
import type { DbTransaction } from "@/lib/db";
import { lockDeal, touched } from "@/lib/deals/lock";
import { noticeDetail } from "@/lib/deals/notice-detail";
import { isSecured } from "@/lib/deals/slot";
import { recordNotification, type Recorded } from "@/lib/notifications/record";

/**
 * The system ends one active reservation because the post was removed or a
 * person's account was deleted. One that is secured (money agreed or a handover
 * said) cannot be cancelled, so it becomes "disputed" for an admin to look at,
 * as expireDeals does; any other is cancelled. The people in it are told once
 * (everyone but `skip`, whose account is going away). The caller syncs the
 * post's units when the post stays.
 */
export async function endActiveDeal(tx: DbTransaction, dealId: string, now: Date, skip?: string): Promise<(Recorded | null)[]> {
  const found = await lockDeal(tx, dealId);
  if (!found || (found.status !== "agreed" && found.status !== "scheduled")) return [];
  const secured = isSecured(found);
  const type = secured ? "deal_disputed" : "deal_cancelled";
  await tx.update(deal).set({ status: secured ? "disputed" : "cancelled", ...touched(now) }).where(eq(deal.id, found.id));
  const notices: (Recorded | null)[] = [];
  for (const recipientId of [found.ownerId, found.responderId]) {
    if (recipientId === skip) continue;
    notices.push(
      await recordNotification(tx, {
        type,
        recipientId,
        postId: found.postId,
        conversationId: found.conversationId,
        onceKey: `deal:${found.id}:${secured ? "disputed" : "cancelled"}`,
        detail: noticeDetail(found, type),
      }),
    );
  }
  return notices;
}
