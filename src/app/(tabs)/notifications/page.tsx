import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listNotifications } from "@/lib/notifications/list";
import { headline } from "@/lib/notifications/text";
import { NotificationList } from "../../notifications/notification-list";

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
      <PageHeader title="Notifications" back="/" />
      <main className="mx-auto w-full max-w-md flex-1">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Notifications />
        </Suspense>
      </main>
    </>
  );
}

async function Notifications() {
  const me = await requireActiveStudent();
  const items = await listNotifications(me.id);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">Nothing yet. New messages, hearts on your posts and expiring posts show up here.</p>
        <Link href="/" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
          Browse the feed
        </Link>
      </div>
    );
  }
  return (
    <NotificationList
      rows={items.map((n) => ({ id: n.id, headline: headline(n.type, n.count), postTitle: n.postTitle, read: n.read, when: when(n.at), href: n.href }))}
    />
  );
}
