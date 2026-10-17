import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { deal, offer, post, student } from "@/db/schema";
import { buildCalendar, HANDOVER_MINUTES, type CalendarEvent } from "@/lib/calendar/ics";
import { hashToken } from "@/lib/calendar/token";
import { asMethod, METHOD_LABEL } from "@/lib/deals/handover";
import { getDb } from "@/lib/db";
import { consume } from "@/lib/rate-limit";

/**
 * A student's scheduled handovers as calendar events. Only the post title,
 * time and place are read: no names, amounts or notes. With `only`, just that deal.
 */
export async function listHandovers(
  studentId: string,
  origin: string,
  only?: { dealId: string },
): Promise<CalendarEvent[]> {
  const rows = await getDb()
    .select({
      id: deal.id,
      title: post.title,
      scheduledAt: deal.scheduledAt,
      place: deal.place,
      method: deal.handoverMethod,
      conversationId: offer.conversationId,
      updatedAt: deal.updatedAt,
    })
    .from(deal)
    .innerJoin(post, eq(post.id, deal.postId))
    .innerJoin(offer, eq(offer.id, deal.offerId))
    .where(
      and(
        eq(deal.status, "scheduled"),
        isNotNull(deal.scheduledAt),
        or(eq(deal.ownerId, studentId), eq(deal.responderId, studentId)),
        only ? eq(deal.id, only.dealId) : undefined,
      ),
    )
    .orderBy(asc(deal.scheduledAt))
    .limit(200);

  const events: CalendarEvent[] = [];
  for (const r of rows) {
    if (!r.scheduledAt || !r.place || !r.method) continue; // guaranteed by deal_scheduled_fields
    events.push({
      uid: `deal-${r.id}@studiskarte`,
      start: r.scheduledAt,
      minutes: HANDOVER_MINUTES,
      summary: `Handover: ${r.title}`,
      location: r.place,
      description: `${METHOD_LABEL[asMethod(r.method)]}. Open the conversation: ${origin}/messages/${r.conversationId}`,
      updatedAt: r.updatedAt,
    });
  }
  return events;
}

export type FeedResult = { status: 200; body: string } | { status: 404 } | { status: 429 };

/** The calendar behind a private link: `file` is "<token>.ics". The token is the only credential. */
export async function renderFeed(file: string, origin: string, now = new Date()): Promise<FeedResult> {
  const match = /^([A-Za-z0-9_-]{43})\.ics$/.exec(file);
  if (!match) return { status: 404 };
  const hash = hashToken(match[1]);
  const [owner] = await getDb()
    .select({ id: student.id })
    .from(student)
    .where(and(eq(student.calendarTokenHash, hash), eq(student.accountStatus, "active")));
  if (!owner) return { status: 404 };
  if (!(await consume({ action: "calendar_feed", key: hash, max: 120, windowSeconds: 3600 }))) return { status: 429 };
  return {
    status: 200,
    body: buildCalendar({ name: "Studiskarte handovers", events: await listHandovers(owner.id, origin), now }),
  };
}
