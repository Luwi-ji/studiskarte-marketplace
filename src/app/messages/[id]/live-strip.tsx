import type { LiveStatus } from "./use-live-thread";

/**
 * The slim pill above the message box that says what the other person just did while the page catches up, then
 * "Updated" for a moment. It is always in the page and opens and closes by height and opacity (instantly with reduced
 * motion), so the message box grows and shrinks smoothly instead of a strip popping in.
 */
export function LiveStrip({ status: { open, done, text } }: { status: LiveStatus }) {
  return (
    <div
      role="status"
      className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "max-h-16 opacity-100" : "max-h-0 opacity-0"}`}
    >
      <p
        aria-hidden={!open}
        className={`mx-auto mb-2 flex w-fit max-w-full items-center gap-2 rounded-full bg-zinc-100 py-1.5 pl-2.5 pr-3.5 text-sm transition-transform duration-200 ease-out motion-reduce:transition-none dark:bg-zinc-800 ${open ? "translate-y-0" : "translate-y-2"}`}
      >
        {done ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-green-600 dark:stroke-green-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 animate-spin fill-none text-brand-text motion-reduce:animate-none" strokeWidth="3" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" opacity="0.25" />
            <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeLinecap="round" />
          </svg>
        )}
        <span className="line-clamp-2">{text}</span>
      </p>
    </div>
  );
}
