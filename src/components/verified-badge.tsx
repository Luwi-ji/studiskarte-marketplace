import { BadgeButton } from "@/components/badge-button";

/** Shown for an active student who signed in with a verified school email. An icon; tapping it says what it means. */
export function VerifiedBadge({ interactive = true }: { interactive?: boolean }) {
  return (
    <BadgeButton
      title="School email"
      description="Signed in with a verified school email."
      className="text-brand-text"
      interactive={interactive}
      icon={
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M10 1.5l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L10 18.5l-2.2-1.6-2.7.1-.9-2.6L2 12.8l.8-2.6L2 7.6l2.2-1.6.9-2.6 2.7.1zm-1 11.3l4.6-4.6-1.1-1.1L9 10.6 7.5 9.1 6.4 10.2z" />
        </svg>
      }
    />
  );
}
