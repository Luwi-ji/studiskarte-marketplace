import { z } from "zod";
import type { Availability } from "@/lib/posts/schema";

/** A deal that is not scheduled within this many days of being accepted is cancelled. [Assumed, blueprint 01.] */
export const SCHEDULE_IDLE_DAYS = 7;
/** A scheduled deal not confirmed by both within this many days after its time is cancelled. [Assumed.] */
export const CONFIRM_IDLE_DAYS = 7;
/** A handover can be planned this far ahead, no further. */
export const PLAN_AHEAD_DAYS = 60;
export const PLACE_MAX = 200;
/** Reminders before the meeting, in minutes. [Assumed: one day and one hour.] */
export const BEFORE_REMINDERS = [
  { key: "1d", minutes: 24 * 60 },
  { key: "1h", minutes: 60 },
] as const;
/** Reminders to confirm after the meeting, in days, for the one who has not confirmed yet. [Assumed: 1 and 3 days.] */
export const CONFIRM_REMINDER_DAYS = [1, 3] as const;

export type HandoverMethod = "meetup" | "delivery";

export const METHOD_LABEL: Record<HandoverMethod, string> = { meetup: "Meet-up", delivery: "Delivery" };

const MANILA_OFFSET = "+08:00";
const DAY_MS = 86_400_000;

const inputSchema = z.object({
  method: z.enum(["meetup", "delivery"]),
  date: z.string().max(10),
  time: z.string().max(5),
  place: z.string().max(PLACE_MAX * 2).default(""),
});

export type Proposal = { method: HandoverMethod; at: Date; place: string };

export type ParsedProposal = { ok: true; data: Proposal } | { ok: false; error: string; field?: "method" | "date" | "time" | "place" };

/** Whether a Philippine date and time fall inside one of the post's availability windows. */
export function withinAvailability(date: string, time: string, windows: Availability[]): boolean {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return windows.some((w) => {
    const day = w.kind === "weekly" ? w.weekday === weekday : w.date === date;
    return day && time >= w.startTime && time <= w.endTime;
  });
}

/**
 * Checks a proposed handover: a method the post offers, a Philippine date and
 * time in the future (up to 60 days ahead) inside the post's availability, and
 * a place of 1 to 200 characters.
 */
export function parseProposal(input: unknown, post: { methods: HandoverMethod[]; windows: Availability[] }, now = new Date()): ParsedProposal {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That could not be saved. Check it and try again." };
  const { method, date, time } = parsed.data;
  if (!post.methods.includes(method)) return { ok: false, error: "This post does not offer that way to hand it over.", field: "method" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return { ok: false, error: "Choose a date.", field: "date" };
  if (!/^\d{2}:\d{2}$/.test(time) || Number.isNaN(Date.parse(`${date}T${time}:00${MANILA_OFFSET}`))) return { ok: false, error: "Choose a time.", field: "time" };
  const at = new Date(`${date}T${time}:00${MANILA_OFFSET}`);
  if (at.getTime() <= now.getTime()) return { ok: false, error: "Choose a time that has not passed.", field: "time" };
  if (at.getTime() > now.getTime() + PLAN_AHEAD_DAYS * DAY_MS) return { ok: false, error: `Choose a time within the next ${PLAN_AHEAD_DAYS} days.`, field: "date" };
  if (!withinAvailability(date, time, post.windows)) return { ok: false, error: "That is outside the days and hours this post is available. Pick a time inside them.", field: "time" };
  const place = parsed.data.place.trim();
  if (place.length < 1 || place.length > PLACE_MAX) return { ok: false, error: `Say where, up to ${PLACE_MAX} characters.`, field: "place" };
  return { ok: true, data: { method, at, place } };
}

/** The moment, in Philippine time, as people read it: "Sat, Oct 18, 3:00 PM". */
export function formatHandoverTime(at: Date): string {
  return new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(at);
}

/** Whether a scheduled handover can be confirmed yet: from its time on. */
export function canConfirmNow(scheduledAt: Date, now = new Date()): boolean {
  return scheduledAt.getTime() <= now.getTime();
}
