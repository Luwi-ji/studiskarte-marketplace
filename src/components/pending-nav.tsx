"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";

/** A quick answer never shows a skeleton: it appears only if the new results take longer than this. The highlight is never delayed. */
const SKELETON_DELAY_MS = 120;

type Go = (href: string, options?: { id?: string; replace?: boolean }) => void;
type PendingNavValue = {
  /** The tab tapped last while its page is still loading; null when nothing is loading or the navigation did not come from a tab. */
  tappedId: string | null;
  /** A navigation has been in flight longer than the delay. */
  slow: boolean;
  go: Go;
};

const PendingNavContext = createContext<PendingNavValue | null>(null);

/**
 * Wraps a page's header and results (around its Suspense) so that a tab tap is felt at once: `PendingTabLink`s show the
 * tapped tab as current immediately, and `PendingResults` swaps the results for a skeleton if the new ones are slow.
 * The navigation runs in a transition, so the old page stays until the new one is ready and both states drop by themselves
 * when it settles (or fails). Server-rendered children pass through untouched.
 */
export function PendingNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tappedId, setTappedId] = useOptimistic<string | null>(null);
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setElapsed(true), SKELETON_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setElapsed(false);
    };
  }, [pending]);

  const go = useCallback<Go>(
    (href, options) => {
      startTransition(() => {
        // The latest tap wins: a tap with no tab (Filters) clears an earlier tab's highlight too.
        setTappedId(options?.id ?? null);
        if (options?.replace) router.replace(href);
        else router.push(href);
      });
    },
    [router, setTappedId],
  );

  const value = useMemo(() => ({ tappedId, slow: pending && elapsed, go }), [tappedId, pending, elapsed, go]);
  return <PendingNavContext.Provider value={value}>{children}</PendingNavContext.Provider>;
}

/** Navigate like `router.push` (or `replace`), inside a `PendingNav` if there is one so the results show their skeleton meanwhile. */
export function useNavigate(): Go {
  const ctx = useContext(PendingNavContext);
  const router = useRouter();
  return useCallback<Go>(
    (href, options) => {
      if (ctx) ctx.go(href, options);
      else if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [ctx, router],
  );
}

/** The id of the tab that should look current right now: the one just tapped, else the page's own. */
export function useShownTab(current: string | undefined): string | undefined {
  return useContext(PendingNavContext)?.tappedId ?? current;
}

/**
 * A tab that is a real link (middle-click, new tab and keyboard behave as usual) but whose plain click navigates in
 * the `PendingNav`'s transition. `current` is what the page says; the tapped tab overrides it until the page settles.
 * `goesTo` is the tab that is current once this link's page has loaded, when that is not the link's own `id`.
 */
export function PendingTabLink({
  id,
  goesTo = id,
  href,
  replace,
  current,
  onClass,
  offClass,
  children,
}: {
  id: string;
  goesTo?: string;
  href: string;
  replace?: boolean;
  current: boolean;
  onClass: string;
  offClass: string;
  children: ReactNode;
}) {
  const ctx = useContext(PendingNavContext);
  const shown = ctx?.tappedId != null ? ctx.tappedId === id : current;
  return (
    <Link
      href={href}
      replace={replace}
      aria-current={shown ? "page" : undefined}
      className={shown ? onClass : offClass}
      onNavigate={(event) => {
        // The tab already shown as current has nothing to move to: let the link do what it normally does.
        // (The school chip is shown as current yet clears the school, so it goes elsewhere.)
        if (!ctx || (shown && goesTo === id)) return;
        event.preventDefault();
        ctx.go(href, { id: goesTo, replace });
      }}
    >
      {children}
    </Link>
  );
}

/**
 * The results area. While a navigation is slow it shows `skeleton` (or `skeletonFor[tappedTabId]`; null there keeps the
 * old results) in their place and keeps the old results mounted but hidden, so nothing is lost if the navigation fails.
 */
export function PendingResults({
  children,
  skeleton,
  skeletonFor,
  className = "",
}: {
  children: ReactNode;
  skeleton: ReactNode;
  skeletonFor?: Record<string, ReactNode>;
  className?: string;
}) {
  const ctx = useContext(PendingNavContext);
  const target = ctx?.tappedId ?? null;
  const shownSkeleton = target !== null && skeletonFor && target in skeletonFor ? skeletonFor[target] : skeleton;
  const showing = Boolean(ctx?.slow && shownSkeleton);

  // The new results will start at the top, so go there now: a short skeleton under a scrolled page would jump.
  useLayoutEffect(() => {
    if (showing) window.scrollTo({ top: 0, behavior: "instant" });
  }, [showing]);

  return (
    <>
      <div className={showing ? "hidden" : className} aria-busy={showing || undefined}>
        {children}
      </div>
      {showing ? (
        <div role="status">
          <span className="sr-only">Loading</span>
          {shownSkeleton}
        </div>
      ) : null}
    </>
  );
}
