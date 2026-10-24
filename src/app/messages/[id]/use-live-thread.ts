"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { liveLabel } from "@/lib/notifications/live-label";

// How often an open thread asks for news: quick while something is happening, slower as it goes quiet.
const BUSY_MS = 4_000;
const QUIET_MS = 8_000;
const IDLE_MS = 15_000;
const QUIET_AFTER_MS = 60_000;
const IDLE_AFTER_MS = 5 * 60_000;
// A second look shortly after an alert, in case the first one beat the server's write.
const AGAIN_MS = 2_500;
// The status line stays this long after the page has updated, so it can be read, and never longer than the cap.
const SHOW_MS = 1_200;
const CAP_MS = 8_000;

/**
 * Keeps an open conversation current:
 * - refreshes at once when the device receives an alert about this conversation (the service worker passes it on),
 *   and shows what happened while it does;
 * - refreshes when the app comes back to the front (focus, visible again, back online);
 * - polls every few seconds while visible: faster after recent activity, slower as it goes quiet, paused when hidden.
 * `activityKey` changes whenever the conversation did, which keeps the polling quick.
 */
export function useLiveThread(conversationId: string, activityKey: string): string | null {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const lastChange = useRef(0);
  const lastRefresh = useRef(0);
  const waiting = useRef(false);
  const clearTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(() => {
    lastRefresh.current = Date.now();
    startTransition(() => router.refresh());
  }, [router]);

  useEffect(() => {
    lastChange.current = Date.now();
  }, [activityKey]);

  // The status line goes once the refreshed page is in.
  useEffect(() => {
    if (pending || !waiting.current) return;
    waiting.current = false;
    window.clearTimeout(clearTimer.current);
    clearTimer.current = window.setTimeout(() => setStatus(null), SHOW_MS);
  }, [pending]);

  useEffect(() => {
    let timer: number | undefined;
    const delay = () => {
      const quiet = Date.now() - lastChange.current;
      return quiet < QUIET_AFTER_MS ? BUSY_MS : quiet < IDLE_AFTER_MS ? QUIET_MS : IDLE_MS;
    };
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, delay());
    }
    function tick() {
      // Hidden: no work, and nothing scheduled. Coming back to the front starts it again.
      if (document.visibilityState !== "visible") return;
      refresh();
      schedule();
    }
    function comeBack() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh.current > 1_000) refresh();
      schedule();
    }
    lastChange.current = Date.now();
    schedule();
    document.addEventListener("visibilitychange", comeBack);
    window.addEventListener("focus", comeBack);
    window.addEventListener("online", comeBack);
    window.addEventListener("pageshow", comeBack);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", comeBack);
      window.removeEventListener("focus", comeBack);
      window.removeEventListener("online", comeBack);
      window.removeEventListener("pageshow", comeBack);
    };
  }, [refresh]);

  // An alert for this conversation reached the device (public/sw.js passes it to the open pages).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let again: number | undefined;
    let cap: number | undefined;
    function onMessage(event: MessageEvent) {
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || !("type" in data) || data.type !== "alert") return;
      if (!("url" in data) || data.url !== `/messages/${conversationId}`) return;
      lastChange.current = Date.now();
      const label = "tag" in data && typeof data.tag === "string" ? liveLabel(data.tag) : null;
      if (label) {
        setStatus(label);
        waiting.current = true;
        window.clearTimeout(clearTimer.current);
        window.clearTimeout(cap);
        cap = window.setTimeout(() => {
          waiting.current = false;
          setStatus(null);
        }, CAP_MS);
      }
      refresh();
      window.clearTimeout(again);
      again = window.setTimeout(refresh, AGAIN_MS);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.clearTimeout(again);
      window.clearTimeout(cap);
      window.clearTimeout(clearTimer.current);
    };
  }, [conversationId, refresh]);

  return status;
}
