"use client";

import { useEffect, useRef, useState } from "react";

const CHECK_EVERY_MS = 5 * 60 * 1000;

async function currentVersion(): Promise<string | null> {
  try {
    const response = await fetch("/api/version", { cache: "no-store" });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "version" in body && typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

/** The address of a plain in-app link click that should become a full page load, or null to leave the click alone. */
function reloadTarget(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download")) return null;
  if (link.target !== "" && link.target !== "_self") return null;
  const href = link.getAttribute("href") ?? "";
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  const url = new URL(href, window.location.href);
  // Same page (or only the #hash changes): nothing to load.
  if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return null;
  return url.href;
}

/**
 * Tells the person when the app was updated while this page stayed open. An app on the Home Screen keeps running the
 * old scripts until it is reloaded, and old scripts can call things that no longer exist, so buttons do nothing.
 *
 * The version is checked at once when the app comes back to the foreground or a page is restored from the back/forward
 * cache, and every few minutes. Once a newer version is seen the banner stays, and the next tap on a link inside the
 * app loads that page from the server instead of navigating in place, so the new scripts arrive with it.
 */
export function UpdateNotice() {
  const loadedWith = useRef<string | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    async function check() {
      const version = await currentVersion();
      if (!alive || version === null) return;
      if (loadedWith.current === null) loadedWith.current = version;
      else if (version !== loadedWith.current) setStale(true);
    }
    void check();
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Out of date: the next in-app link tap is a full page load. Capture phase on the document runs before React's own
  // handlers, which must not also start a client-side navigation.
  useEffect(() => {
    if (!stale) return;
    const onClick = (event: MouseEvent) => {
      const target = reloadTarget(event);
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(target);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [stale]);

  if (!stale) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex items-center justify-between gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
      <span>A new version is ready.</span>
      <button type="button" onClick={() => window.location.reload()} className="h-11 shrink-0 rounded-lg bg-white px-4 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-white">
        Reload
      </button>
    </div>
  );
}
