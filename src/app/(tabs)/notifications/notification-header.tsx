"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/page-header";
import { markAllNotificationsReadAction } from "@/app/notifications/actions";

export function NotificationHeader({ unreadCount, loading = false }: { unreadCount: number; loading?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function markAllRead() {
    if (loading || pending || unreadCount === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await markAllNotificationsReadAction();
      } catch {
        setError("Could not mark notifications as read. Try again.");
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        back="/"
        action={
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={markAllRead}
              disabled={loading || pending || unreadCount === 0}
              aria-label={pending ? "Marking all notifications as read" : "Mark all as read"}
              aria-busy={pending}
              title={pending ? "Marking all as read…" : "Mark all as read"}
              className="press flex h-11 w-11 items-center justify-center rounded-full text-brand-text disabled:opacity-40"
            >
              {pending ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <circle cx="12" cy="12" r="9" className="opacity-25" />
                  <path d="M12 3a9 9 0 0 1 9 9" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m3 12 4 4L17 6M12 16l3 3 7-9" />
                </svg>
              )}
            </button>
            <Link
              href="/me/settings/alerts"
              aria-label="Alerts on this device"
              title="Alerts on this device"
              className="press flex h-11 w-11 items-center justify-center rounded-full text-brand-text"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
              </svg>
            </Link>
          </div>
        }
      />
      <p role="status" className="sr-only">{pending ? "Marking all notifications as read…" : ""}</p>
      {error ? (
        <p role="alert" className="mx-auto w-full max-w-md px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </>
  );
}
