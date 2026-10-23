"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { cancelDeal } from "@/lib/deals/cancel";
import { declineOffer, withdrawOffer } from "@/lib/deals/offers";
import { sendAlertAfterResponse } from "@/lib/notifications/push/schedule";

const inputSchema = z.object({
  action: z.enum(["withdraw", "decline", "cancel"]),
  ids: z.array(z.uuid()).min(1).max(30),
});

export type BulkTransactionResult = { id: string; ok: boolean; error?: string };

/** Runs only actions that already exist for one transaction; each domain function rechecks the actor and state. */
export async function bulkTransactionsAction(input: unknown): Promise<{ ok: true; results: BulkTransactionResult[] } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose between 1 and 30 transactions." };
  const me = await requireActiveStudent();
  const { action, ids } = parsed.data;
  const results = await Promise.all(
    ids.map(async (id): Promise<BulkTransactionResult> => {
      const result =
        action === "withdraw"
          ? await withdrawOffer({ responderId: me.id, offerId: id })
          : action === "decline"
            ? await declineOffer({ ownerId: me.id, offerId: id, alert: sendAlertAfterResponse })
            : await cancelDeal({ actorId: me.id, dealId: id, alert: sendAlertAfterResponse });
      return result.ok ? { id, ok: true } : { id, ok: false, error: result.error };
    }),
  );
  if (results.some((result) => result.ok)) refresh();
  return { ok: true, results };
}
