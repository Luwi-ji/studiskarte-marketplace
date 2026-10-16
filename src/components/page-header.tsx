import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Sticky top bar for a page: an optional back link (a 44 px target, since an
 * installed app has no browser back button), the title, and an optional action.
 * Pads for the notch with env(safe-area-inset-top).
 */
export function PageHeader({ title, back, action, logo }: { title: string; back?: string; action?: ReactNode; logo?: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-[var(--background)]/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800">
      <div className="mx-auto flex h-14 w-full max-w-md items-center gap-1 px-2">
        {back ? (
          <Link href={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl">
            ‹
          </Link>
        ) : logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.png" alt="" className="mx-1.5 h-8 w-8 rounded-lg" />
        ) : (
          <span className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {action}
      </div>
    </header>
  );
}
