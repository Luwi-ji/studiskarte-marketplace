"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useOptimistic, useState, useTransition, type MouseEventHandler, type ReactNode } from "react";
import { resultsKindFor, type ResultsKind } from "@/lib/discovery/results-kind";

/** A quick answer never shows a skeleton: it appears only if the new results take longer than this. The highlight is never delayed. */
const SKELETON_DELAY_MS = 120;

type Go = (href: string, options?: { id?: string; replace?: boolean }) => void;
type PendingNavValue = {
  /** The tab tapped last while its page is still loading; null when nothing is loading or the navigation did not come from a tab. */
  tappedId: string | null;
  /** What the page being navigated to will show; null when nothing is loading. */
  kind: ResultsKind | null;
  /** Where the navigation in flight is going; null when nothing is loading. */
  href: string | null;
  /** A navigation has been in flight longer than the delay. */
  slow: boolean;
  go: Go;
};

const PendingNavContext = createContext<PendingNavValue | null>(null);

/**
 * Wraps a page's header and results (around its Suspense) so that a tap is felt at once: `PendingTabLink`s show the
 * tapped tab as current immediately, and `PendingResults` swaps the results for a skeleton if the new ones are slow.
 * Every navigation from the page's header and results (tabs, search, Filters, Clear, Show) goes through `go`, so they all
 * behave the same. The navigation runs in a transition, so the old page stays until the new one is ready and both
 * states drop by themselves when it settles (or fails). Server-rendered children pass through untouched.
 */
export function PendingNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tapped, setTapped] = useOptimistic<{ id: string | null; kind: ResultsKind; href: string } | null>(null);
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
        setTapped({ id: options?.id ?? null, kind: resultsKindFor(href), href });
        if (options?.replace) router.replace(href);
        else router.push(href);
      });
    },
    [router, setTapped],
  );

  const value = useMemo(
    () => ({ tappedId: tapped?.id ?? null, kind: tapped?.kind ?? null, href: tapped?.href ?? null, slow: pending && elapsed, go }),
    [tapped, pending, elapsed, go],
  );
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

/** Where the navigation in flight is going, or null: what the page's address is about to become. */
export function usePendingHref(): string | null {
  return useContext(PendingNavContext)?.href ?? null;
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
 * Any other link that navigates from a page's header or results (Show, Clear filters...): a real link whose plain click
 * goes through the `PendingNav`, so it gets the same instant response as a tab. `id` is the tab that will be current.
 */
export function PendingLink({
  href,
  replace,
  id,
  prefetch,
  current,
  className,
  onClick,
  children,
}: {
  href: string;
  replace?: boolean;
  id?: string;
  prefetch?: boolean;
  /** Marks the link as the current choice for assistive technology. */
  current?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  children: ReactNode;
}) {
  const ctx = useContext(PendingNavContext);
  return (
    <Link
      href={href}
      replace={replace}
      prefetch={prefetch}
      aria-current={current ? "true" : undefined}
      className={className}
      onClick={onClick}
      onNavigate={(event) => {
        if (!ctx) return;
        event.preventDefault();
        ctx.go(href, { id, replace });
      }}
    >
      {children}
    </Link>
  );
}

/**
 * The results area. While a navigation is slow it shows the skeleton of what the new page will show (`skeletonFor[kind]`,
 * else `skeleton`) in place of the results, every time and whatever they are (cards, a list, a hint, the categories),
 * and keeps the old results mounted but hidden, so nothing is lost if the navigation fails.
 */
export function PendingResults({
  children,
  skeleton,
  skeletonFor,
  className = "",
}: {
  children: ReactNode;
  skeleton: ReactNode;
  skeletonFor?: Partial<Record<ResultsKind, ReactNode>>;
  className?: string;
}) {
  const ctx = useContext(PendingNavContext);
  const shownSkeleton = (ctx?.kind && skeletonFor?.[ctx.kind]) || skeleton;
  const showing = Boolean(ctx?.slow);

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
