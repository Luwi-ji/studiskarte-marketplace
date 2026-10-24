import { BadgeButton } from "@/components/badge-button";

/** Shown instead of the School email badge for someone who signed up without a school email. A neutral grey chip; tapping it shows its name. */
export function GuestBadge({ interactive = true }: { interactive?: boolean }) {
  return (
    <BadgeButton
      title="Guest"
      description="Signed up with a personal email, not a school email"
      tone="grey"
      interactive={interactive}
      icon={
        <svg viewBox="0 0 20 20" className="h-full w-full" fill="currentColor" aria-hidden>
          <circle cx="10" cy="6.5" r="3.5" />
          <path d="M3 17.5c0-3.6 3.1-6 7-6s7 2.4 7 6z" />
        </svg>
      }
    />
  );
}
