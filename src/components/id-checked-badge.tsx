import { BadgeButton } from "@/components/badge-button";

/** Shown while the owner's check of a school ID is current. A green chip; tapping it shows its name. */
export function IdCheckedBadge() {
  return (
    <BadgeButton
      title="ID checked"
      description="The owner checked a school ID."
      tone="green"
      icon={
        <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6l8-3z" />
          <path d="m8.5 12 2.5 2.5 4.5-4.5" />
        </svg>
      }
    />
  );
}
