"use client";

import Link from "next/link";
import { setDeviceValue, useDeviceValue } from "@/lib/device-value";
import type { DealCardData } from "./handover-panel";

const BUTTON = "press flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700";
const NOTE = "text-xs text-zinc-500";

const whenFormat = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const when = (at: string) => whenFormat.format(new Date(at));

/** What this device was last given for a reservation: the agreed time and place at that moment. */
type Added = { at: string; place: string };

const keyFor = (dealId: string) => `studiskarte:calendar-added:${dealId}`;

function parseAdded(raw: string | null): Added | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "at" in value && "place" in value && typeof value.at === "string" && typeof value.place === "string") {
      return { at: value.at, place: value.place };
    }
  } catch {
    // A damaged entry counts as nothing added.
  }
  return null;
}

/** One line saying what changed since the file was added. */
function changeLine(was: Added, now: Added): string {
  const timeChanged = was.at !== now.at;
  const placeChanged = was.place !== now.place;
  const what = timeChanged && placeChanged ? "The time and place changed" : timeChanged ? "The time changed" : "The place changed";
  const from = timeChanged ? `${when(was.at)}${placeChanged ? `, ${was.place}` : ""}` : was.place;
  const to = timeChanged ? `${when(now.at)}${placeChanged ? `, ${now.place}` : ""}` : now.place;
  return `${what} from ${from} to ${to}. Remove the old event, then add this one.`;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * What to do about the calendar for a reservation with an agreed time: add it
 * while it is scheduled (this device remembers what it added, so it says whether
 * the file is already in the calendar and whether the time or place has changed
 * since), remove it once it was cancelled or disputed. Nothing in any other
 * state. The downloads are plain anchors: they are files, not pages.
 */
export function CalendarActions({ deal }: { deal: DealCardData }) {
  const key = keyFor(deal.id);
  const added = parseAdded(useDeviceValue(key));
  if (!deal.handover) return null;
  const file = `/api/calendar/deal/${deal.id}`;
  const current: Added = { at: deal.handover.at, place: deal.handover.place };
  const remember = () => setDeviceValue(key, JSON.stringify(current));

  if (deal.status === "scheduled") {
    const stale = added !== null && (added.at !== current.at || added.place !== current.place);

    if (added && !stale) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <Check />
              Added to calendar
            </p>
            <a href={file} download onClick={remember} className="press flex h-11 items-center px-3 text-sm font-medium text-brand-text underline">
              Add again
            </a>
          </div>
          <p className={NOTE}>
            On this phone you added this time. Subscribed in Settings? Your calendar updates by itself.{" "}
            <Link href="/me/settings/calendar" className="font-medium text-brand-text underline">
              Calendar link
            </Link>
          </p>
        </div>
      );
    }

    if (added) {
      return (
        <div className="flex flex-col gap-1">
          <p role="status" className="text-sm font-medium">
            {changeLine(added, current)}
          </p>
          <a href={file} download onClick={remember} className={BUTTON}>
            Update calendar
          </a>
          <p className={NOTE}>
            Updates the event you added. Subscribed in Settings? Your calendar already changed by itself, so you do not need to add it.{" "}
            <Link href="/me/settings/calendar" className="font-medium text-brand-text underline">
              Calendar link
            </Link>
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        <a href={file} download onClick={remember} className={BUTTON}>
          Add to calendar
        </a>
        <p className={NOTE}>
          Adds this one time. If the time changes, come back here to update it. To have every handover kept up to date by itself, subscribe once in Settings.{" "}
          <Link href="/me/settings/calendar" className="font-medium text-brand-text underline">
            Calendar link
          </Link>
        </p>
      </div>
    );
  }

  if (deal.status === "cancelled" || deal.status === "disputed") {
    return (
      <div className="flex flex-col gap-1">
        <a href={file} download onClick={() => setDeviceValue(key, null)} className={BUTTON}>
          Remove from your calendar
        </a>
        <p className={NOTE}>
          If you subscribed in Settings, your calendar drops it by itself (Google Calendar can take several hours). If you added the file, open this one to remove it.
        </p>
      </div>
    );
  }

  return null;
}
