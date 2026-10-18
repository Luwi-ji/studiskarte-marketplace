import { z } from "zod";
import type { Availability } from "@/lib/posts/schema";

/** A deal that is not scheduled within this many days of being accepted is cancelled. [Assumed, blueprint 01.] */
export const SCHEDULE_IDLE_DAYS = 7;
/** A scheduled deal not confirmed by both within this many days after its time is cancelled. [Assumed.] */
export const CONFIRM_IDLE_DAYS = 7;
/** A handover can be planned this far ahead, no further. */
export const PLAN_AHEAD_DAYS = 60;
export const PLACE_MAX = 200;
/** Meet-ups happen in school hours, Philippine time: from 6:00 AM to 8:00 PM, both included. Delivery is not limited. */
export const MEETUP_FIRST = "06:00";
export const MEETUP_LAST = "20:00";
export const MEETUP_HOURS_MESSAGE = "Meet-ups are between 6:00 AM and 8:00 PM. Pick a time in those hours.";

/** Whether a "HH:MM" time falls inside meet-up hours. */
export function withinMeetupHours(time: string): boolean {
  return time >= MEETUP_FIRST && time <= MEETUP_LAST;
}

/** Reminders before the meeting, in minutes. [Assumed: one day and two hours.] */
export const BEFORE_REMINDERS = [
  { key: "1d", minutes: 24 * 60 },
  { key: "2h", minutes: 2 * 60 },
] as const;
/** Reminders to confirm after the meeting, in days, for the one who has not confirmed yet. [Assumed: 1 and 3 days.] */
export const CONFIRM_REMINDER_DAYS = [1, 3] as const;

export type HandoverMethod = "meetup" | "delivery";

export const METHOD_LABEL: Record<HandoverMethod, string> = { meetup: "Meet-up", delivery: "Delivery" };

/** A stored method name as the type; the database allows only these two. */
export function asMethod(value: string): HandoverMethod {
  return value === "delivery" ? "delivery" : "meetup";
}

const MANILA_OFFSET = "+08:00";
const MANILA_MS = 8 * 60 * 60 * 1000;

/**
 * Today's date in the Philippines as "YYYY-MM-DD", by plain arithmetic. The tap
 * handlers of the handover form use this, not Intl: a phone's locale support
 * must never be able to make a tap do nothing.
 */
export function manilaDate(now: Date): string {
  return new Date(now.getTime() + MANILA_MS).toISOString().slice(0, 10);
}
const DAY_MS = 86_400_000;

const inputSchema = z.object({
  method: z.enum(["meetup", "delivery"]),
  date: z.string().max(10),
  time: z.string().max(5),
  place: z.string().max(PLACE_MAX * 2).default(""),
});

export type Proposal = { method: HandoverMethod; at: Date; place: string };

export type ParsedProposal = { ok: true; data: Proposal } | { ok: false; error: string; field?: "method" | "date" | "time" | "place" };

/** The availability windows that cover a Philippine date (a weekday every week, or that exact date). */
export function windowsOn(date: string, windows: Availability[]): Availability[] {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return windows.filter((w) => (w.kind === "weekly" ? w.weekday === weekday : w.date === date));
}

/** Whether a Philippine date and time fall inside one of the post's availability windows. */
export function withinAvailability(date: string, time: string, windows: Availability[]): boolean {
  return windowsOn(date, windows).some((w) => time >= w.startTime && time <= w.endTime);
}

/** "13:30" as people read it in the Philippines: "1:30 PM". */
export function time12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * The time a form should start with for a day, as "HH:MM": the start of the
 * post's availability that day (9:00 AM for the owner, who has no limit), or,
 * if that has already passed today, the next full hour. So a proposal made
 * with the first day and the starting time is never in the past.
 */
export function suggestTime(date: string, windows: Availability[] | null, now = new Date(), method: HandoverMethod = "meetup"): string {
  // A meet-up cannot be suggested outside meet-up hours, whatever an older post's window says.
  const fit = (time: string) => (method === "meetup" && !withinMeetupHours(time) ? "09:00" : time);
  const first = windows === null ? undefined : [...windowsOn(date, windows)].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  const start = fit(first ? first.startTime : "09:00");
  const today = manilaDate(now);
  if (date !== today) return start;
  const wall = new Date(now.getTime() + MANILA_MS); // the Philippine wall clock, read as UTC
  const nowMinutes = wall.getUTCHours() * 60 + wall.getUTCMinutes();
  const [h, m] = start.split(":").map(Number);
  if (h * 60 + m > nowMinutes) return start;
  const next = (Math.floor(nowMinutes / 60) + 1) * 60;
  return next >= 24 * 60 ? start : fit(`${String(next / 60).padStart(2, "0")}:00`);
}

/** An hour (1 to 12), minute and AM or PM as "HH:MM" on the 24-hour clock. */
export function to24h(hour: number, minute: number, pm: boolean): string {
  return `${String((hour % 12) + (pm ? 12 : 0)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat, Oct 17" for a "YYYY-MM-DD" date. */
function dayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${WEEKDAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${MONTH_SHORT[month - 1]} ${day}`;
}

/**
 * The days that can be chosen, from today (Philippine time) up to 60 days ahead.
 * With the post's availability only the days it covers; with null (the owner)
 * every day.
 */
export function chooseableDays(windows: Availability[] | null, now = new Date()): { date: string; label: string }[] {
  const today = manilaDate(now);
  const days: { date: string; label: string }[] = [];
  for (let i = 0; i <= PLAN_AHEAD_DAYS; i++) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) + i * DAY_MS).toISOString().slice(0, 10);
    if (windows !== null && windowsOn(date, windows).length === 0) continue;
    days.push({ date, label: dayLabel(date) });
  }
  return days;
}

/**
 * Checks a proposed handover: a method the post offers, a Philippine date and
 * time in the future (up to 60 days ahead), and a place of 1 to 200 characters.
 * The time must be inside the post's availability, unless `windows` is null:
 * the owner may propose any time (an early handover, a special case).
 */
export function parseProposal(input: unknown, post: { methods: HandoverMethod[]; windows: Availability[] | null }, now = new Date()): ParsedProposal {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That could not be saved. Check it and try again." };
  const { method, date, time } = parsed.data;
  if (!post.methods.includes(method)) return { ok: false, error: "This post does not offer that way to hand it over.", field: "method" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { ok: false, error: "Choose a date.", field: "date" };
  if (!/^\d{2}:\d{2}$/.test(time) || Number.isNaN(Date.parse(`${date}T${time}:00${MANILA_OFFSET}`))) return { ok: false, error: "Choose a time.", field: "time" };
  if (method === "meetup" && !withinMeetupHours(time)) return { ok: false, error: MEETUP_HOURS_MESSAGE, field: "time" };
  const at = new Date(`${date}T${time}:00${MANILA_OFFSET}`);
  if (at.getTime() <= now.getTime()) return { ok: false, error: "Choose a time that has not passed.", field: "time" };
  if (at.getTime() > now.getTime() + PLAN_AHEAD_DAYS * DAY_MS) return { ok: false, error: `Choose a time within the next ${PLAN_AHEAD_DAYS} days.`, field: "date" };
  if (post.windows !== null && !withinAvailability(date, time, post.windows)) {
    return { ok: false, error: "That is outside the days and hours this post is available. Pick a time inside them.", field: "time" };
  }
  const place = parsed.data.place.trim();
  if (place.length < 1 || place.length > PLACE_MAX) return { ok: false, error: `Say where, up to ${PLACE_MAX} characters.`, field: "place" };
  return { ok: true, data: { method, at, place } };
}

/** The moment, in Philippine time, as people read it: "Sat, Oct 18, 3:00 PM". */
export function formatHandoverTime(at: Date): string {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(at);
}
