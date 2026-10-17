import { formatHandoverTime } from "@/lib/deals/handover";

/**
 * The line under a deal notification's headline: when and where, as people read
 * it in the Philippines ("Sat, Oct 18, 3:00 PM · Library steps"). A proposal
 * notice carries the proposed time and place; every other one the agreed
 * schedule. Null when there is nothing to say yet.
 */
export function noticeDetail(
  d: { scheduledAt: Date | null; place: string | null; proposedAt: Date | null; proposedPlace: string | null },
  type: string,
): string | null {
  const proposal = type === "deal_proposed";
  const at = proposal ? d.proposedAt : d.scheduledAt;
  const place = proposal ? d.proposedPlace : d.place;
  if (!at) return null;
  const when = formatHandoverTime(at);
  return place ? `${when} · ${place}` : when;
}
