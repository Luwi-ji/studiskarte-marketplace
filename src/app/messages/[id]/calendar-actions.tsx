import Link from "next/link";
import type { DealCardData } from "./handover-panel";

const BUTTON = "flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700";
const NOTE = "text-xs text-zinc-500";

/**
 * What to do about the calendar for a reservation with an agreed time: add it
 * while it is scheduled, remove it once it was cancelled or disputed. Nothing in
 * any other state. The downloads are plain anchors: they are files, not pages.
 */
export function CalendarActions({ deal }: { deal: DealCardData }) {
  if (!deal.handover) return null;
  const file = `/api/calendar/deal/${deal.id}`;

  if (deal.status === "scheduled") {
    return (
      <div className="flex flex-col gap-1">
        <a href={file} download className={BUTTON}>
          Add to calendar
        </a>
        <p className={NOTE}>
          Subscribed in Settings? Your calendar updates by itself, though Google Calendar can take several hours. A downloaded file does not update: add it again after any change.{" "}
          <Link href="/me/settings#calendar" className="font-medium text-brand underline">
            Calendar link
          </Link>
        </p>
      </div>
    );
  }

  if (deal.status === "cancelled" || deal.status === "disputed") {
    return (
      <div className="flex flex-col gap-1">
        <a href={file} download className={BUTTON}>
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
