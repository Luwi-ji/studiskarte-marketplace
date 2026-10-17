import { connection } from "next/server";
import { z } from "zod";
import { getSignedInStudent } from "@/lib/access";
import { listHandovers } from "@/lib/calendar/feed";
import { buildCalendar, CALENDAR_NAME } from "@/lib/calendar/ics";

/** One handover as an .ics download, for the people of that deal. A cancelled one downloads as a cancellation, which removes the earlier import. */
export async function GET(request: Request, { params }: RouteContext<"/api/calendar/deal/[id]">) {
  // Request-time only: never run this while the app is being built.
  await connection();
  const me = await getSignedInStudent(request.headers);
  if (!me) return new Response("Sign in first", { status: 401 });
  const id = (await params).id;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const events = await listHandovers(me.id, new URL(request.url).origin, { dealId: id });
  if (events.length === 0) return new Response("Not found", { status: 404 });
  return new Response(buildCalendar({ name: CALENDAR_NAME, events }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="handover.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
