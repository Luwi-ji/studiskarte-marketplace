"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type MouseEvent, type ReactNode } from "react";

/** The Navigation API is not in every TypeScript DOM lib; `canGoBack` only counts entries of this site. */
type NavigationLike = { canGoBack: boolean };

/** True when going back stays inside the app. Browsers without the Navigation API fall back to history length. */
export function canGoBackInApp(): boolean {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  return navigation ? navigation.canGoBack : window.history.length > 1;
}

/** The Settings list opens its pages with `?from=settings`; this is the address back to it. */
export const FROM_SETTINGS = "from=settings";
const SETTINGS = "/me/settings";

/**
 * The back arrow, for a page that has none of its own (a tab page such as Perks or My posts) but was opened from Settings:
 * it goes back to where the person was, or to Settings when the page was opened directly. Anywhere else, `fallback`
 * (the logo or a spacer) shows.
 */
function FromSettingsBack({ fallback, onBack }: { fallback: ReactNode; onBack: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const fromSettings = useSearchParams().get("from") === "settings";
  if (!fromSettings) return <>{fallback}</>;
  return (
    <Link href={SETTINGS} onClick={onBack} aria-label="Back to Settings" className="press flex h-11 w-11 items-center justify-center rounded-full text-2xl">
      ‹
    </Link>
  );
}

/**
 * Sticky top bar for a page: an optional back link (a 44 px target, since an
 * installed app has no browser back button), the title, and an optional action.
 * Back returns to the page the student came from (keeping the feed's loaded
 * cards, filters and scroll); `back` is the link used when there is nowhere to
 * go back to, such as a post opened from a shared link.
 * Pads for the notch with env(safe-area-inset-top). `titleHref` makes the title a link (a conversation's name opens the profile).
 */
export function PageHeader({ title, titleHref, back, onBack, action, logo }: { title: ReactNode; titleHref?: string; back?: string; /** Runs instead of going back, for a page that asks first (unsaved changes). */ onBack?: () => void; action?: ReactNode; logo?: boolean }) {
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    // Let a new-tab or new-window click behave as a link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (onBack) {
      event.preventDefault();
      onBack();
      return;
    }
    if (!canGoBackInApp()) return;
    event.preventDefault();
    router.back();
  }

  // What shows at the left when there is no back arrow: the logo, or a small gap.
  const leading = logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="" className="mx-1.5 h-8 w-8 rounded-lg" />
  ) : (
    <span className="w-2" />
  );

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-[var(--background)]/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800">
      <div className="mx-auto flex h-14 w-full max-w-md items-center gap-1 px-2">
        {back ? (
          <Link href={back} onClick={goBack} aria-label="Back" className="press flex h-11 w-11 items-center justify-center rounded-full text-2xl">
            ‹
          </Link>
        ) : (
          <Suspense fallback={leading}>
            <FromSettingsBack fallback={leading} onBack={goBack} />
          </Suspense>
        )}
        {titleHref ? (
          <h1 className="min-w-0 flex-1 text-lg font-semibold">
            {/* A 44 px tall link inside the 56 px bar, so the title keeps its place and still ellipsizes. */}
            <Link href={titleHref} className="flex h-11 min-w-0 items-center active:opacity-80">
              <span className="truncate">{title}</span>
            </Link>
          </h1>
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        )}
        {action}
      </div>
    </header>
  );
}
