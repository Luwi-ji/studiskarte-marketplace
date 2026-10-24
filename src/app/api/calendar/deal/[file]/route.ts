import { connection } from "next/server";
import { z } from "zod";
import { getSignedInStudent } from "@/lib/access";
import { listHandovers } from "@/lib/calendar/feed";
import { buildCalendar, CALENDAR_NAME, EVENT_FILE_HEADERS } from "@/lib/calendar/ics";

/**
 * One handover as a single-event .ics ("<deal id>.ics"), for the people of that deal. A phone opens it for "Add to
 * Calendar". A cancelled one is a cancellation, which removes the earlier import.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/calendar/deal/[file]">) {
  // Request-time only: never run this while the app is being built.
  await connection();
  const me = await getSignedInStudent(request.headers);
  if (!me) return new Response("Sign in first", { status: 401 });
  const id = /^(.+)\.ics$/.exec((await params).file)?.[1];
  if (!id || !z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const events = await listHandovers(me.id, new URL(request.url).origin, { dealId: id });
  if (events.length === 0) return new Response("Not found", { status: 404 });
  return new Response(buildCalendar({ name: CALENDAR_NAME, events, once: true }), { headers: EVENT_FILE_HEADERS });
}
