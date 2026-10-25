import { Suspense } from "react";
import Link from "next/link";
import { requireActiveStudent } from "@/lib/access";
import { countUnreadNotifications, listNotifications } from "@/lib/notifications/list";
import { headline } from "@/lib/notifications/text";
import { AlertsToggle } from "@/components/alerts-toggle";
import { alertsConfigured } from "@/lib/notifications/push/notify";
import { NotificationsSkeleton } from "@/components/list-skeletons";
import { NotificationList } from "../../notifications/notification-list";
import { NotificationHeader } from "./notification-header";

export const metadata = { title: "Notifications · Studiskarte Marketplace" };

const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

/** "3:42 PM" today, "Oct 15" otherwise (Philippine time). */
function when(at: Date, now = new Date()): string {
  return dateFormat.format(at) === dateFormat.format(now) ? timeFormat.format(at) : dateFormat.format(at);
}

export default function NotificationsPage() {
  return (
    <>
      <Suspense fallback={<NotificationHeader unreadCount={0} loading />}>
        <Header />
      </Suspense>
      <main className="mx-auto w-full max-w-md flex-1">
        <Suspense fallback={<NotificationsSkeleton />}>
          <Notifications />
        </Suspense>
      </main>
    </>
  );
}

async function Header() {
  const me = await requireActiveStudent();
  const unreadCount = await countUnreadNotifications(me.id);
  return <NotificationHeader unreadCount={unreadCount} />;
}

async function Notifications() {
  const me = await requireActiveStudent();
  const items = await listNotifications(me.id);
  const banner = <AlertsToggle publicKey={alertsConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null} />;
  if (items.length === 0) {
    return (
      <>
        {banner}
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <p className="text-zinc-600 dark:text-zinc-400">Nothing yet. New messages, reservations, handover reminders and hearts on your posts show up here.</p>
          <Link href="/" className="press flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
            Browse the feed
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      {banner}
      <NotificationList
        rows={items.map((n) => ({ id: n.id, headline: headline(n.type, n.count, n.detail), postTitle: n.postTitle, detail: n.detail, read: n.read, when: when(n.at), href: n.href }))}
      />
    </>
  );
}
