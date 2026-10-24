import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { requireActiveStudent } from "@/lib/access";
import { getOwnProfile } from "@/lib/identity/profile";
import { hasVisiblePerks } from "@/lib/perks/list";
import { ROLE_LABEL } from "@/lib/identity/roles";
import { getObjectStore } from "@/lib/images/store";
import { AlertsRowValue } from "@/components/alerts-toggle";
import { AppearanceRowValue } from "@/components/appearance-settings";
import { currentLegal, LEGAL_SLUGS, LEGAL_TITLES, type LegalSlug } from "@/lib/legal/documents";
import { alertsConfigured } from "@/lib/notifications/push/notify";
import { hasCalendarToken } from "@/lib/calendar/token";
import { verificationEnabled } from "@/lib/verification/config";
import { getMyCheck, type MyCheck } from "@/lib/verification/service";
import { ProfileAvatar, SettingsSection, SettingsIcon, SettingsRow } from "@/components/settings-list";
import { SocialLinks } from "@/components/social-links";
import { FACEBOOK_REVIEWS_URL, HELP_PATHS } from "@/lib/support/config";
import { SettingsSkeleton } from "@/components/list-skeletons";
import { SignOutRow } from "./sign-out-row";
import { SavedToast } from "./saved-toast";

export const metadata = { title: "Settings · Studiskarte Marketplace" };

const LEGAL_BLURB: Record<LegalSlug, string> = {
  terms: "The rules for using Studiskarte.",
  privacy: "What we collect about you and how we use it.",
  guidelines: "What is and is not allowed in posts and messages.",
  "child-safety": "How we keep younger members safe.",
};

const PICTURE_LINK_SECONDS = 5 * 60;

function idCheckState(check: MyCheck): string {
  if (check.checked) {
    const until = check.expiresAt?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
    return until ? `Checked until ${until}` : "Checked";
  }
  if (check.open?.status === "pending") return "Waiting for the owner";
  if (!check.open && check.lastRejection) return "Not approved";
  return "Not checked";
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" back="/me" />
      <main className="mx-auto w-full max-w-md flex-1 pb-6">
        <Suspense fallback={<SettingsSkeleton />}>
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
  const pictureUrl = profile.avatarKey ? await getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS) : null;
  const calendarActive = await hasCalendarToken(me.id);
  const idCheck = verificationEnabled() ? await getMyCheck(me.id) : null;
  const legal = currentLegal();

  const hasPerks = await hasVisiblePerks(me.schoolDomain);
  // The tab bar shows Perks when the school has any, and My posts otherwise; the other one is a row here.
  const activity = [
    hasPerks ? { href: "/me/posts", label: "My posts", icon: "grid" as const } : { href: "/perks", label: "Perks", icon: "gift" as const },
    { href: `/u/${profile.handle}`, label: "My profile", icon: "user" as const },
    { href: "/me/hearts", label: "Hearted posts", icon: "heart" as const },
    { href: "/notifications", label: "Notifications", icon: "bell" as const },
    { href: "/me/transactions", label: "Transactions", icon: "receipt" as const },
    { href: "/me/blocked", label: "Blocked people", icon: "block" as const },
    ...(me.isAdmin ? [{ href: "/admin", label: "Admin", icon: "tool" as const }] : []),
  ];

  return (
    <>
      <SavedToast />
      <SettingsSection label="Your account">
        <SettingsRow
          href="/me/settings/profile"
          tall
          icon={<ProfileAvatar src={pictureUrl} name={profile.displayName} size="md" />}
          label={<span className="font-semibold">{profile.displayName}</span>}
          description={`@${profile.handle} · Edit profile`}
        />
        {me.role === "visitor" ? (
          <SettingsRow href="/me/settings/school-email" icon={<SettingsIcon name="school" />} label="Become a student" description="Add your school email to join your school." />
        ) : (
          <SettingsRow icon={<SettingsIcon name="school" />} label={ROLE_LABEL[me.role]} description={`${profile.school}. Set from your school email, which is never shown to others.`} />
        )}
      </SettingsSection>

      <SettingsSection label="How you use Studiskarte">
        <SettingsRow
          href="/me/settings/alerts"
          icon={<SettingsIcon name="bell" />}
          label="Alerts on this device"
          value={<AlertsRowValue publicKey={alertsConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null} />}
        />
        <SettingsRow href="/me/settings/calendar" icon={<SettingsIcon name="calendar" />} label="Calendar" value={calendarActive ? "Linked" : "Not linked"} />
        <SettingsRow href="/me/settings/appearance" icon={<SettingsIcon name="sun" />} label="Appearance" value={<AppearanceRowValue />} />
        {activity.map((row) => (
          <SettingsRow key={row.href} href={row.href} icon={<SettingsIcon name={row.icon} />} label={row.label} />
        ))}
      </SettingsSection>

      {idCheck ? (
        <SettingsSection label="Verification">
          <SettingsRow
            href="/me/verify"
            icon={<SettingsIcon name="shield" />}
            label="ID check"
            description={idCheck.checked ? undefined : "Optional. Adds an ID checked badge."}
            value={idCheckState(idCheck)}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection label="Help and support">
        <SettingsRow href={HELP_PATHS.faq} icon={<SettingsIcon name="help" />} label="FAQs" description="Answers to common questions about Studiskarte." />
        <SettingsRow href={HELP_PATHS.reportListing} icon={<SettingsIcon name="flag" />} label="Report a listing" description="Paste the listing's link." />
        <SettingsRow href={HELP_PATHS.reportUser} icon={<SettingsIcon name="user" />} label="Report a user" description="Enter their username." />
        <SettingsRow href={HELP_PATHS.bug} icon={<SettingsIcon name="bug" />} label="Report a bug" description="Something is not working." />
        <SettingsRow href={HELP_PATHS.feedback} icon={<SettingsIcon name="chat" />} label="Send feedback" description="Suggestions, compliments and ideas." />
        <SettingsRow href={HELP_PATHS.contact} icon={<SettingsIcon name="mail" />} label="Contact us" description="Write to the Studiskarte team." />
      </SettingsSection>

      <SettingsSection label="Follow Studiskarte">
        <li className="flex flex-col gap-3 px-4 py-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Follow us for updates, tips and new features.</p>
          <SocialLinks />
        </li>
        <SettingsRow href={FACEBOOK_REVIEWS_URL} external icon={<SettingsIcon name="star" />} label="Leave a review on Facebook" description="Tell others what you think of Studiskarte." />
      </SettingsSection>

      {legal ? (
        <SettingsSection label="Legal and safety">
          {LEGAL_SLUGS.map((slug) => (
            <SettingsRow key={slug} href={`/legal/${slug}`} icon={<SettingsIcon name="doc" />} label={LEGAL_TITLES[slug]} description={LEGAL_BLURB[slug]} />
          ))}
        </SettingsSection>
      ) : null}

      <SettingsSection label="Account">
        <SignOutRow />
        {me.isAdmin ? null : <SettingsRow href="/me/settings/delete-account" label="Delete my account" danger plain />}
      </SettingsSection>
    </>
  );
}
