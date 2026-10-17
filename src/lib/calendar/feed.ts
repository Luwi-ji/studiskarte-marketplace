import { and, asc, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import { deal, offer, post, student } from "@/db/schema";
import { buildCalendar, CALENDAR_NAME, HANDOVER_MINUTES, type CalendarEvent } from "@/lib/calendar/ics";
import { hashToken } from "@/lib/calendar/token";
import { asMethod, METHOD_LABEL } from "@/lib/deals/handover";
import { getDb } from "@/lib/db";
import { consume } from "@/lib/rate-limit";

const DAY_MS = 86_400_000;
/** A cancelled or disputed handover stays in the feed this long, as a cancelled event, so a subscribed calendar drops it. */
export const CANCELLED_KEPT_DAYS = 30;

/**
 * A student's handovers as calendar events: the scheduled ones, and the ones
 * that were cancelled or disputed in the last 30 days (as cancelled events, so a
 * calendar that has them removes them). Only the post title, time, place, the
 * method and whether the student hands it over or receives it are read: no
 * names, amounts or notes. With `only`, just that deal, whatever its age.
 */
export async function listHandovers(
  studentId: string,
  origin: string,
  only?: { dealId: string },
  now = new Date(),
): Promise<CalendarEvent[]> {
  const rows = await getDb()
    .select({
      id: deal.id,
      title: post.title,
      postKind: post.kind,
      ownerId: deal.ownerId,
      status: deal.status,
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
        isNotNull(deal.scheduledAt),
        or(eq(deal.ownerId, studentId), eq(deal.responderId, studentId)),
        only
          ? and(eq(deal.id, only.dealId), inArray(deal.status, ["scheduled", "cancelled", "disputed"]))
          : or(
              eq(deal.status, "scheduled"),
              and(inArray(deal.status, ["cancelled", "disputed"]), gte(deal.activityAt, new Date(now.getTime() - CANCELLED_KEPT_DAYS * DAY_MS))),
            ),
      ),
    )
    .orderBy(asc(deal.scheduledAt))
    .limit(200);

  const events: CalendarEvent[] = [];
  for (const r of rows) {
    if (!r.scheduledAt || !r.place || !r.method) continue; // a schedule always has all three
    const cancelled = r.status !== "scheduled";
    // On a Wishlist the one who posted it receives the item; on a Showcase the one who posted it hands it over.
    const handsOver = (r.postKind === "wishlist") !== (r.ownerId === studentId);
    const summary = `Studiskarte: ${r.title}`;
    events.push({
      uid: `deal-${r.id}@studiskarte`,
      start: r.scheduledAt,
      minutes: HANDOVER_MINUTES,
      summary: cancelled ? `Cancelled: ${summary}` : summary,
      location: r.place,
      description: `${cancelled ? "This was cancelled. " : ""}${handsOver ? "You hand it over" : "You receive it"} (${METHOD_LABEL[asMethod(r.method)]}). Open the conversation: ${origin}/messages/${r.conversationId}`,
      status: cancelled ? "cancelled" : "confirmed",
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
    body: buildCalendar({ name: CALENDAR_NAME, events: await listHandovers(owner.id, origin, undefined, now), now }),
  };
}
