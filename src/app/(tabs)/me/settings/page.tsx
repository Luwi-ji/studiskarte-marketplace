import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { requireActiveStudent } from "@/lib/access";
import { getOwnProfile } from "@/lib/identity/profile";
import { getObjectStore } from "@/lib/images/store";
import { AlertsToggle } from "@/components/alerts-toggle";
import { LegalLinks } from "@/components/legal-links";
import { alertsConfigured } from "@/lib/notifications/push/notify";
import { hasCalendarToken } from "@/lib/calendar/token";
import { CalendarLink } from "./calendar-link";
import { DeleteAccount } from "./delete-account";
import { AvatarForm, DisplayNameForm, HandleForm, SignOutButton } from "./settings-forms";

export const metadata = { title: "Settings · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Me" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <Settings />
        </Suspense>
      </main>
    </>
  );
}

async function Settings() {
  const me = await requireActiveStudent();
  const profile = await getOwnProfile(me.id);
  if (!profile?.handle) notFound();
  const pictureUrl = profile.avatarKey
    ? await getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS)
    : null;
  const nextChangeOn = profile.nextHandleChangeAt
    ? profile.nextHandleChangeAt.toLocaleDateString("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" })
    : null;
  const calendarActive = await hasCalendarToken(me.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{profile.displayName}</p>
        <p className="text-sm text-zinc-500">
          @{profile.handle} · {profile.school}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href={`/u/${profile.handle}`} className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
          My profile
        </Link>
        <Link href="/me/hearts" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
          Hearted
        </Link>
        <Link href="/notifications" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
          Notifications
        </Link>
        <Link href="/me/transactions" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
          Transactions
        </Link>
        <Link href="/me/blocked" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
          Blocked students
        </Link>
        {me.isAdmin ? (
          <Link href="/admin" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
            Admin
          </Link>
        ) : null}
      </div>
      <AvatarForm pictureUrl={pictureUrl} />
      <DisplayNameForm current={profile.displayName} />
      <HandleForm current={profile.handle} nextChangeOn={nextChangeOn} />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">School</span>
        <p className="text-zinc-700 dark:text-zinc-300">{profile.school}</p>
        <p className="text-xs text-zinc-500">Set from your school email, which is never shown to others.</p>
      </div>
      <AlertsToggle publicKey={alertsConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null} />
      <CalendarLink active={calendarActive} />
      <SignOutButton />
      <LegalLinks />
      {me.isAdmin ? null : <DeleteAccount handle={profile.handle} />}
    </div>
  );
}
