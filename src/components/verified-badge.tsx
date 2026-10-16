/** Shown for every active student: each one signed in with a verified school email. */
export function VerifiedBadge() {
  return (
    <span
      title="Verified student"
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2 text-xs font-medium text-brand"
    >
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        <path d="M10 1.5l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L10 18.5l-2.2-1.6-2.7.1-.9-2.6L2 12.8l.8-2.6L2 7.6l2.2-1.6.9-2.6 2.7.1zm-1 11.3l4.6-4.6-1.1-1.1L9 10.6 7.5 9.1 6.4 10.2z" />
      </svg>
      Verified
    </span>
  );
}
