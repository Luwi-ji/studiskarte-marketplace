import { FACEBOOK_URL, INSTAGRAM_URL } from "@/lib/support/config";

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-current" aria-hidden>
      <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.6V13h2.7v8h3.2z" />
    </svg>
  );
}

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" className="fill-current" />
    </svg>
  );
}

const LINK = "press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 text-base font-medium dark:border-zinc-700";

/** Follow buttons for the Studiskarte pages. Open in a new tab. */
export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <div className={`flex gap-3 ${className}`}>
      <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
        <FacebookGlyph />
        <span>Facebook</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
        <InstagramGlyph />
        <span>Instagram</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
