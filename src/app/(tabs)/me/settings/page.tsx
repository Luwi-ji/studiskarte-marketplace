import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { notFound } from "next/navigation";
import { requireActiveStudent } from "@/lib/access";
import { getOwnProfile } from "@/lib/identity/profile";
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
import { SettingsDrawer } from "@/components/settings-drawer";
import { ReplayTourRow } from "@/components/onboarding-tour";
import { InstallRow } from "@/components/install";
import { tourKindFor } from "@/lib/tour/steps";
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

  // Pages that are also tabs or profiles carry ?from=settings, so their back arrow returns here.
  const from = "?from=settings";
  const selling = [
    { href: `/me/posts${from}`, label: "My posts", icon: "grid" as const, description: "Track, edit and relist your listings." },
    { href: `/u/${profile.handle}/sold${from}`, label: "Items sold", icon: "receipt" as const, description: "What you have sold to other students." },
    { href: `/u/${profile.handle}/bought${from}`, label: "Items bought", icon: "receipt" as const, description: "What you have bought. Only you can see this." },
    { href: "/me/transactions", label: "Transactions", icon: "refresh" as const, description: "Deals in progress and finished." },
  ];
  const activity = [
    { href: `/u/${profile.handle}${from}`, label: "My profile", icon: "user" as const },
    { href: "/me/hearts", label: "Hearted posts", icon: "heart" as const },
    { href: `/notifications${from}`, label: "Notifications", icon: "bell" as const },
    { href: "/me/blocked", label: "Blocked people", icon: "block" as const },
    ...(me.isAdmin ? [{ href: "/admin", label: "Admin", icon: "tool" as const }] : []),
  ];

  const verified = me.role !== "visitor";
  return (
    <>
      <SavedToast />
      {/* The most important thing to do comes first: it unlocks selling and earns a badge. */}
      <SettingsSection label="Your account">
        <SettingsRow
          href="/me/settings/profile"
          tall
          icon={<ProfileAvatar src={pictureUrl} name={profile.displayName} size="md" />}
          label={<span className="font-semibold">{profile.displayName}</span>}
          description={`@${profile.handle} · Edit profile`}
        />
        <SettingsRow icon={<SettingsIcon name="user" />} label={ROLE_LABEL[me.role]} description={me.role === "visitor" ? "Signed up with a personal email." : `${profile.school}. Set from your school email.`} />
      </SettingsSection>

      <SettingsSection label="Verification" note={verified ? undefined : "Guests can buy and post Wishlists. A school email makes you a student, who can also sell."}>
        {verified ? (
          <SettingsRow icon={<SettingsIcon name="school" />} label="School email" description="Confirmed. It is never shown to others." value="Verified" />
        ) : (
          <SettingsRow href="/me/settings/school-email" icon={<SettingsIcon name="school" />} label="Verify your school email" description="Become a student: sell, and earn the School email badge." value="Not verified" />
        )}
        {idCheck ? (
          <SettingsRow
            href="/me/verify"
            icon={<SettingsIcon name="shield" />}
            label="ID check"
            description={idCheck.checked ? undefined : "Optional. Adds an ID checked badge and lifts the selling limits."}
            value={idCheckState(idCheck)}
          />
        ) : null}
      </SettingsSection>

      <SettingsSection label="Perks">
        <SettingsRow href="/perks?from=settings" icon={<SettingsIcon name="gift" />} label="Student perks" description="Discounts from shops for students." />
      </SettingsSection>

      <SettingsSection label="Preferences">
        <SettingsRow
          href="/me/settings/alerts"
          icon={<SettingsIcon name="bell" />}
          label="Alerts on this device"
          value={<AlertsRowValue publicKey={alertsConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null} />}
        />
        <SettingsRow href="/me/settings/calendar" icon={<SettingsIcon name="calendar" />} label="Calendar" value={calendarActive ? "Linked" : "Not linked"} />
        <SettingsRow href="/me/settings/appearance" icon={<SettingsIcon name="sun" />} label="Appearance" value={<AppearanceRowValue />} />
        <InstallRow />
        <ReplayTourRow kind={tourKindFor(me.role)} name={profile.displayName} />
      </SettingsSection>

      <SettingsSection label="Selling and buying">
        {selling.map((row) => (
          <SettingsRow key={row.href} href={row.href} icon={<SettingsIcon name={row.icon} />} label={row.label} description={row.description} />
        ))}
      </SettingsSection>

      <SettingsSection label="Your activity">
        {activity.map((row) => (
          <SettingsRow key={row.href} href={row.href} icon={<SettingsIcon name={row.icon} />} label={row.label} />
        ))}
      </SettingsSection>

      <SettingsSection label="Help and legal">
        <SettingsDrawer icon={<SettingsIcon name="help" />} label="Help and support" description="FAQs, reports, bugs, feedback and contact." title="Help and support">
          <SettingsRow href={HELP_PATHS.faq} icon={<SettingsIcon name="help" />} label="FAQs" description="Answers to common questions about Studiskarte." />
          <SettingsRow href={HELP_PATHS.reportListing} icon={<SettingsIcon name="flag" />} label="Report a listing" description="Paste the listing's link." />
          <SettingsRow href={HELP_PATHS.reportUser} icon={<SettingsIcon name="user" />} label="Report a user" description="Enter their username." />
          <SettingsRow href={HELP_PATHS.bug} icon={<SettingsIcon name="bug" />} label="Report a bug" description="Something is not working." />
          <SettingsRow href={HELP_PATHS.feedback} icon={<SettingsIcon name="chat" />} label="Send feedback" description="Suggestions, compliments and ideas." />
          <SettingsRow href={HELP_PATHS.contact} icon={<SettingsIcon name="mail" />} label="Contact us" description="Write to the Studiskarte team." />
        </SettingsDrawer>
        {legal ? (
          <SettingsDrawer icon={<SettingsIcon name="doc" />} label="Legal and safety" description="Terms, privacy, guidelines and child safety." title="Legal and safety">
            {LEGAL_SLUGS.map((slug) => (
              <SettingsRow key={slug} href={`/legal/${slug}`} icon={<SettingsIcon name="doc" />} label={LEGAL_TITLES[slug]} description={LEGAL_BLURB[slug]} />
            ))}
          </SettingsDrawer>
        ) : null}
      </SettingsSection>

      <SettingsSection label="Follow Studiskarte">
        <li className="flex flex-col gap-3 px-4 py-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Follow us for updates, tips and new features.</p>
          <SocialLinks />
        </li>
        <SettingsRow href={FACEBOOK_REVIEWS_URL} external icon={<SettingsIcon name="star" />} label="Leave a review on Facebook" description="Tell others what you think of Studiskarte." />
      </SettingsSection>

      <SettingsSection label="Account">
        <SignOutRow />
        {me.isAdmin ? null : <SettingsRow href="/me/settings/delete-account" label="Delete my account" danger plain />}
      </SettingsSection>
    </>
  );
}
