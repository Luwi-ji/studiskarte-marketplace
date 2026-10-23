import { MEETUP_FIRST, MEETUP_HOURS_MESSAGE, MEETUP_LAST, withinMeetupHours } from "@/lib/deals/handover";
import { PAYMENT_LABEL, paymentModesOf } from "@/lib/payment";
import { formatTime } from "@/lib/posts/format";
import type { PostFields } from "@/lib/posts/schema";

// What the post form's rows say about the current choice, and the helpers behind the availability picker.
// Pure, so they are tested without a browser. They never change what is saved.

type Entry = PostFields["availability"][number];

/** Monday first, as on most Philippine school timetables (Sunday is 0). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The shortcut chips above the day chips. */
export const DAY_SHORTCUTS = [
  { id: "every", label: "Every day", days: [1, 2, 3, 4, 5, 6, 0] },
  { id: "weekdays", label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { id: "weekends", label: "Weekends", days: [6, 0] },
] as const;

/** Whether exactly these weekdays are chosen. */
export function sameDays(chosen: readonly number[], days: readonly number[]): boolean {
  return chosen.length === days.length && days.every((day) => chosen.includes(day));
}

export type TimePreset = { id: string; label: string; start: string; end: string };

/** "08:00" as "8 AM", "13:30" as "1:30 PM". */
export function shortTime(time: string): string {
  const full = formatTime(time);
  return full.replace(":00 ", " ");
}

/** The quick time ranges. A post that offers meet-ups is held to meet-up hours, so the long ones are cut to fit. */
export function timePresets(meetup: boolean): TimePreset[] {
  const last = meetup ? MEETUP_LAST : "21:00";
  return [
    { id: "morning", label: "Morning", start: "08:00", end: "12:00" },
    { id: "afternoon", label: "Afternoon", start: "13:00", end: "17:00" },
    { id: "evening", label: "Evening", start: "18:00", end: last },
    { id: "all-day", label: "All day", start: meetup ? MEETUP_FIRST : "00:00", end: meetup ? MEETUP_LAST : "23:59" },
  ];
}

/** The times a new day starts with when nothing else is known: inside meet-up hours. */
export const DEFAULT_TIMES = { startTime: "09:00", endTime: "17:00" };

/** Why a day's times cannot be saved, in the words the server uses; undefined when they can. */
export function timeProblem(entry: { startTime: string; endTime: string }, meetup: boolean): string | undefined {
  if (!entry.startTime || !entry.endTime) return "Choose a start and an end time.";
  const start = entry.startTime.slice(0, 5);
  const end = entry.endTime.slice(0, 5);
  if (end <= start) return "The end time must be after the start time.";
  if (meetup && !(withinMeetupHours(start) && withinMeetupHours(end))) return MEETUP_HOURS_MESSAGE;
  return undefined;
}

function orderOf(weekday: number): number {
  return WEEK_ORDER.indexOf(weekday);
}

/** "Every day", "Weekends", "Mon-Fri", "Mon, Wed, Fri": consecutive days (Monday first) of three or more collapse into a range. */
export function describeDays(weekdays: readonly number[]): string {
  const sorted = [...new Set(weekdays)].sort((a, b) => orderOf(a) - orderOf(b));
  if (sorted.length === 7) return "Every day";
  if (sameDays(sorted, [6, 0])) return "Weekends";
  const runs: number[][] = [];
  for (const day of sorted) {
    const run = runs[runs.length - 1];
    if (run && orderOf(day) === orderOf(run[run.length - 1]) + 1) run.push(day);
    else runs.push([day]);
  }
  return runs
    .flatMap((run) => (run.length >= 3 ? [`${SHORT_DAY[run[0]]}-${SHORT_DAY[run[run.length - 1]]}`] : run.map((day) => SHORT_DAY[day])))
    .join(", ");
}

const SHORT_DATE = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });

/** One line for the row: "Mon-Fri, 9:00 AM to 5:00 PM". Different times per day read "Mon-Fri, times differ". */
export function summarizeAvailability(entries: readonly Entry[]): string {
  if (entries.length === 0) return "Choose your days";
  const weekly = entries.flatMap((entry) => (entry.kind === "weekly" ? [entry.weekday] : []));
  const dates = entries.flatMap((entry) => (entry.kind === "date" ? [entry.date] : [])).sort();
  const parts: string[] = [];
  if (weekly.length > 0) parts.push(describeDays(weekly));
  if (dates.length > 0) parts.push(dates.length <= 3 ? dates.map((date) => SHORT_DATE.format(new Date(`${date}T00:00:00Z`))).join(", ") : `${dates.length} dates`);
  const [first] = entries;
  if (entries.some((entry) => !entry.startTime || !entry.endTime)) return `${parts.join(", ")}, choose a time`;
  const same = entries.every((entry) => entry.startTime === first.startTime && entry.endTime === first.endTime);
  const time = same ? `${formatTime(first.startTime)} to ${formatTime(first.endTime)}` : "times differ";
  return `${parts.join(", ")}, ${time}`;
}

/** "1", "5" or "No limit". */
export function quantitySummary(quantity: string, unlimited: boolean): string {
  if (unlimited) return "No limit";
  return quantity.trim() === "" ? "1" : quantity.trim();
}

/** "Meet-up", "Delivery", "Meet-up and delivery". */
export function handoverSummary(meetup: boolean, delivery: boolean): string {
  if (meetup && delivery) return "Meet-up and delivery";
  if (meetup) return "Meet-up";
  if (delivery) return "Delivery";
  return "Choose one";
}

/** "Cash", "Cash, online payment". */
export function paymentSummary(modes: { paymentCash: boolean; paymentOnline: boolean; paymentOther: boolean }): string {
  const chosen = paymentModesOf(modes).map((mode) => PAYMENT_LABEL[mode]);
  return chosen.length === 0 ? "Choose one" : chosen.join(", ");
}

export function audienceSummary(allowNonStudents: boolean): string {
  return allowNonStudents ? "Students and others" : "Students only";
}
