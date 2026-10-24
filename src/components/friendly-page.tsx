import type { ReactNode } from "react";

export const PRIMARY_BUTTON = "press flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-semibold text-white";
export const SECONDARY_LINK = "press flex min-h-11 items-center justify-center px-4 font-medium text-brand-text";

/** A soft compass-and-map drawing in the brand colours; it follows the text colour so it works in light and dark. */
function Illustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-40 text-brand" fill="none" aria-hidden>
      <ellipse cx="80" cy="104" rx="52" ry="8" fill="currentColor" opacity="0.12" />
      <rect x="28" y="22" width="104" height="72" rx="14" fill="currentColor" opacity="0.1" />
      <path d="M28 40h104" stroke="currentColor" strokeWidth="3" opacity="0.35" strokeLinecap="round" />
      <circle cx="40" cy="31" r="2.5" fill="currentColor" opacity="0.5" />
      <circle cx="50" cy="31" r="2.5" fill="currentColor" opacity="0.5" />
      <circle cx="60" cy="31" r="2.5" fill="currentColor" opacity="0.5" />
      <circle cx="80" cy="68" r="18" stroke="currentColor" strokeWidth="3" />
      <path d="M86 62l-4 10-10 4 4-10 10-4z" fill="currentColor" opacity="0.8" />
      <path d="M96 40l14 0M96 48l8 0" stroke="currentColor" strokeWidth="3" opacity="0.3" strokeLinecap="round" />
    </svg>
  );
}

/** Full-page friendly message used by not-found and error screens: logo, drawing, headline, one sentence, buttons. */
export function FriendlyPage({ title, children, actions }: { title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-[max(2rem,env(safe-area-inset-top))] text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Studiskarte" className="h-14 w-14 rounded-2xl shadow-md" />
      <Illustration />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{children}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col items-stretch gap-1">{actions}</div>
    </main>
  );
}
