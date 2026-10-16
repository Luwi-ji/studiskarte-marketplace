"use client";

import Link from "next/link";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export type NotificationRow = {
  id: string;
  headline: string;
  postTitle: string | null;
  read: boolean;
  when: string;
  href: string;
};

/** The list. Tapping an entry marks it read and opens what it is about. */
export function NotificationList({ rows }: { rows: NotificationRow[] }) {
  const unread = rows.filter((r) => !r.read).length;
  return (
    <div className="flex flex-col">
      {unread > 0 ? (
        <div className="flex justify-end px-3 py-2">
          <button
            type="button"
            onClick={() => void markAllNotificationsReadAction()}
            className="flex h-11 items-center rounded-lg px-3 text-sm font-medium text-brand"
          >
            Mark all as read
          </button>
        </div>
      ) : null}
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={row.href}
              onClick={() => {
                if (!row.read) void markNotificationReadAction(row.id);
              }}
              className="flex min-h-16 items-center gap-3 px-3 py-2 active:bg-zinc-100 dark:active:bg-zinc-900"
            >
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.read ? "bg-transparent" : "bg-brand"}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate ${row.read ? "" : "font-semibold"}`}>{row.headline}</p>
                {row.postTitle ? <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{row.postTitle}</p> : null}
              </div>
              <span className="shrink-0 text-xs text-zinc-500">{row.when}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
