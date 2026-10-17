import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { deal, dealReport } from "@/db/schema";
import { getDb } from "@/lib/db";
import { syncAvailability } from "@/lib/deals/capacity";
import { DEAL_CLOSED, DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { lockDeal, touched } from "@/lib/deals/lock";
import { tellOther, type HandoverResult } from "@/lib/deals/schedule";
import { canReport, DETAILS_MAX, REPORT_REASONS } from "@/lib/deals/slot";
import type { AlertSink, Recorded } from "@/lib/notifications/record";

export const TOO_EARLY = "You can report a problem once it can no longer be cancelled (paid, cash in person agreed, or a handover said) or the time has passed. Until then you can cancel.";
export const ALREADY_REPORTED = "You already reported this.";

const inputSchema = z.object({
  fault: z.enum(["mine", "theirs", "unsure"]),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z.string().max(DETAILS_MAX * 2).default(""),
});

/**
 * Either person tells what went wrong with a reservation: whose end it was
 * (theirs, mine, or not sure), the reason and what happened. The first report
 * turns the reservation into "disputed": it is closed without counting as a
 * handover, its units go back to the post, and the other person is told. They
 * can add their own side (one report each). Allowed once the slot is secured
 * (it cannot be cancelled then) or the handover time has passed.
 */
export async function reportDeal(args: { actorId: string; dealId: string; input: unknown; alert?: AlertSink; now?: Date }): Promise<HandoverResult> {
  const now = args.now ?? new Date();
  const parsed = inputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, error: "Choose whose end it was and what happened." };
  const details = parsed.data.details.trim();
  if (details.length > DETAILS_MAX) return { ok: false, error: `Use at most ${DETAILS_MAX} characters.` };

  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<HandoverResult> => {
    const found = await lockDeal(tx, args.dealId);
    if (!found || (found.ownerId !== args.actorId && found.responderId !== args.actorId)) return { ok: false, error: DEAL_NOT_FOUND };
    const active = found.status === "agreed" || found.status === "scheduled";
    if (!active && found.status !== "disputed") return { ok: false, error: DEAL_CLOSED };
    if (active && !canReport(found, now)) return { ok: false, error: TOO_EARLY };

    const otherId = found.ownerId === args.actorId ? found.responderId : found.ownerId;
    const faultPartyId = parsed.data.fault === "mine" ? args.actorId : parsed.data.fault === "theirs" ? otherId : null;
    const [mine] = await tx.select({ id: dealReport.id }).from(dealReport).where(and(eq(dealReport.dealId, found.id), eq(dealReport.reporterId, args.actorId)));
    if (mine) return { ok: false, error: ALREADY_REPORTED };

    await tx.insert(dealReport).values({ dealId: found.id, reporterId: args.actorId, faultPartyId, reason: parsed.data.reason, details: details || null });
    await tx
      .update(deal)
      .set({ ...(active ? { status: "disputed" } : {}), ...touched(now) })
      .where(eq(deal.id, found.id));
    if (active) await syncAvailability(tx, found.postId, now);
    recorded = await tellOther(tx, found, args.actorId, "deal_reported", `reported:${args.actorId}`);
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}
