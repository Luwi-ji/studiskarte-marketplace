import { eq } from "drizzle-orm";
import { availabilityWindow } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { Availability } from "@/lib/posts/schema";

// Monday first, as on most Philippine school timetables (Sunday is 0).
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** A post's availability: weekdays Monday to Sunday, then dates in order. Times as "HH:MM". */
export async function loadAvailability(postId: string): Promise<Availability[]> {
  const rows = await getDb()
    .select({
      weekday: availabilityWindow.weekday,
      onDate: availabilityWindow.onDate,
      startTime: availabilityWindow.startTime,
      endTime: availabilityWindow.endTime,
    })
    .from(availabilityWindow)
    .where(eq(availabilityWindow.postId, postId));

  const entries = rows.map((row): Availability => {
    // Postgres returns times as "HH:MM:SS".
    const times = { startTime: row.startTime.slice(0, 5), endTime: row.endTime.slice(0, 5) };
    if (row.onDate !== null) return { kind: "date", date: row.onDate, ...times };
    // The availability_window_kind CHECK guarantees a weekday when there is no date.
    if (row.weekday === null) throw new Error(`availability row without day or date on post ${postId}`);
    return { kind: "weekly", weekday: row.weekday, ...times };
  });
  const order = (entry: Availability) =>
    entry.kind === "weekly" ? String(WEEK_ORDER.indexOf(entry.weekday)) : `9-${entry.date}`;
  return entries.sort((a, b) => order(a).localeCompare(order(b)));
}
