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

/**
 * Tells the person when the app was updated while this page stayed open (an app
 * on the Home Screen keeps running the old scripts until it is reloaded, and old
 * scripts can call things that no longer exist, so buttons do nothing).
 * Checked when the app comes back to the foreground and every few minutes.
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
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

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
