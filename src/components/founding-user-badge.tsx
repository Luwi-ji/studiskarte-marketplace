import { BadgeButton } from "@/components/badge-button";

/** Shown on the profile of one of the first students to join. An amber chip; tapping it shows its name. */
export function FoundingUserBadge() {
  return (
    <BadgeButton
      title="Founding User"
      description="One of the first 100 members to join Studiskarte."
      tone="amber"
      icon={
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
        </svg>
      }
    />
  );
}
