import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { requireActiveStudent } from "@/lib/access";
import { getOwnProfile } from "@/lib/identity/profile";
import { hasVisiblePerks } from "@/lib/perks/list";
import { ROLE_LABEL } from "@/lib/identity/roles";
import { getObjectStore } from "@/lib/images/store";
import { AlertsToggle } from "@/components/alerts-toggle";
import { LegalLinks } from "@/components/legal-links";
import { alertsConfigured } from "@/lib/notifications/push/notify";
import { hasCalendarToken } from "@/lib/calendar/token";
import { CalendarLink } from "./calendar-link";
import { verificationEnabled } from "@/lib/verification/config";
import { getMyCheck, type MyCheck } from "@/lib/verification/service";
import { DeleteAccount } from "./delete-account";
import { AvatarForm, DisplayNameForm, HandleForm, SignOutButton } from "./settings-forms";
import { SchoolEmailForm } from "./school-email-form";

export const metadata = { title: "Settings · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;

function idCheckState(check: MyCheck): string {
  if (check.checked) {
    const until = check.expiresAt?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
    return until ? `ID checked until ${until}` : "ID checked";
  }
  if (check.open?.status === "pending") return "Waiting for the owner";
  if (!check.open && check.lastRejection) return "Not approved";
  return "Not checked";
}

const ROW = "flex min-h-12 items-center justify-between gap-3 px-1 py-2";
const SECTION_TITLE = "text-lg font-semibold";

function Chevron() {
  return (
    <span aria-hidden className="text-xl text-zinc-500">
      ›
    </span>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
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
    ? profile.nextHandleChangeAt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })
    : null;
  const calendarActive = await hasCalendarToken(me.id);
  const idCheck = verificationEnabled() ? await getMyCheck(me.id) : null;

  const hasPerks = await hasVisiblePerks(me.schoolDomain);
  // The tab bar shows Perks when the school has any, and My posts otherwise; the other one is a row here.
  const activity = [
    hasPerks ? { href: "/me/posts", label: "My posts" } : { href: "/perks", label: "Perks" },
    { href: `/u/${profile.handle}`, label: "My profile" },
    { href: "/me/hearts", label: "Hearted" },
    { href: "/notifications", label: "Notifications" },
    { href: "/me/transactions", label: "Transactions" },
    { href: "/me/blocked", label: "Blocked students" },
    ...(me.isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <h2 className={SECTION_TITLE}>Profile</h2>
        <AvatarForm pictureUrl={pictureUrl} name={profile.displayName} />
        <DisplayNameForm current={profile.displayName} />
        <HandleForm current={profile.handle} nextChangeOn={nextChangeOn} />
        {me.role === "visitor" ? (
          <SchoolEmailForm />
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">School email checked</span>
            <p className="text-zinc-700 dark:text-zinc-300">
              {ROLE_LABEL[me.role]} · {profile.school}
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Set from your school email, which is never shown to others.</p>
          </div>
        )}
        {idCheck ? (
          <Link href="/me/verify" className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
            <span className="flex flex-col">
              <span className="text-sm font-medium">ID check</span>
              <span className="text-sm text-zinc-700 dark:text-zinc-300">{idCheckState(idCheck)}</span>
              {idCheck.checked ? null : <span className="text-sm text-zinc-600 dark:text-zinc-400">Optional. Adds an ID checked badge.</span>}
            </span>
            <Chevron />
          </Link>
        ) : null}
      </section>
      <section className="flex flex-col gap-5">
        <h2 className={SECTION_TITLE}>Alerts and calendar</h2>
        <AlertsToggle publicKey={alertsConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null} />
        <CalendarLink active={calendarActive} />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className={SECTION_TITLE}>Your activity</h2>
        <ul className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {activity.map((row) => (
            <li key={row.href}>
              <Link href={row.href} className={ROW}>
                {row.label}
                <Chevron />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-5">
        <h2 className={SECTION_TITLE}>Account</h2>
        <SignOutButton />
        <LegalLinks />
        {me.isAdmin ? null : <DeleteAccount handle={profile.handle} />}
      </section>
    </div>
  );
}
