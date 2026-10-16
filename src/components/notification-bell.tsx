import { Suspense } from "react";
import Link from "next/link";
import { getSignedInStudent } from "@/lib/access";
import { countUnreadNotifications } from "@/lib/notifications/list";

function BellLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative flex h-11 w-11 items-center justify-center rounded-full"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

async function BellWithCount() {
  const me = await getSignedInStudent();
  return <BellLink unread={me ? await countUnreadNotifications(me.id) : 0} />;
}

/** The bell in the feed header, with the number of unread notifications. */
export function NotificationBell() {
  return (
    <Suspense fallback={<BellLink unread={0} />}>
      <BellWithCount />
    </Suspense>
  );
}
