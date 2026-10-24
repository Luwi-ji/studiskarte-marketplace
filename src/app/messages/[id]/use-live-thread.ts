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
// "Updated" stays this long once the page has caught up, so it can be seen. The status never stays longer than the cap.
const SHOW_MS = 1_000;
const CAP_MS = 8_000;
// A refresh that has not finished by now no longer holds the next one back.
const STUCK_MS = 10_000;

/**
 * What the strip above the message box shows. Closing (`open` false) keeps `text` and `done`, so the strip slides away
 * still showing what it showed.
 */
export type LiveStatus = { open: boolean; done: boolean; text: string };

const IDLE: LiveStatus = { open: false, done: false, text: "" };

/**
 * Keeps an open conversation current:
 * - refreshes at once when the device receives an alert about this conversation (the service worker passes it on),
 *   and says what happened while it does, then "Updated" for a moment. Alerts that come close together share one
 *   status that follows the latest sentence;
 * - refreshes when the app comes back to the front (focus, visible again, back online);
 * - polls every few seconds while visible: faster after recent activity, slower as it goes quiet, paused when hidden.
 * Only one refresh runs at a time, so a burst of alerts or a slow connection never piles up requests.
 * `activityKey` changes whenever the conversation did, which keeps the polling quick.
 */
export function useLiveThread(conversationId: string, activityKey: string, otherName: string): LiveStatus {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<LiveStatus>(IDLE);
  const lastChange = useRef(0);
  const lastRefresh = useRef(0);
  // A refresh is running, and another was asked for while it did.
  const running = useRef(false);
  const queued = useRef(false);
  // The page has not caught up with an alert that has a sentence yet.
  const waiting = useRef(false);
  const doneTimer = useRef<number | undefined>(undefined);
  const capTimer = useRef<number | undefined>(undefined);
  const name = useRef(otherName);
  useEffect(() => {
    name.current = otherName;
  });

  // `again` asks for one more run after the current one (an alert may have come after it started); polling does not.
  const refresh = useCallback(
    (again = false) => {
      if (running.current && Date.now() - lastRefresh.current < STUCK_MS) {
        if (again) queued.current = true;
        return;
      }
      running.current = true;
      lastRefresh.current = Date.now();
      startTransition(() => router.refresh());
    },
    [router],
  );

  useEffect(() => {
    lastChange.current = Date.now();
  }, [activityKey]);

  // The refreshed page is in: run the queued refresh, or show "Updated" for a moment and let the strip go.
  useEffect(() => {
    if (pending) return;
    running.current = false;
    if (queued.current) {
      queued.current = false;
      refresh(false);
      return;
    }
    if (!waiting.current) return;
    waiting.current = false;
    window.clearTimeout(capTimer.current);
    window.clearTimeout(doneTimer.current);
    setStatus({ open: true, done: true, text: "Updated" });
    doneTimer.current = window.setTimeout(() => setStatus((s) => ({ ...s, open: false })), SHOW_MS);
  }, [pending, refresh]);

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
    let second: number | undefined;
    function onMessage(event: MessageEvent) {
      const data: unknown = event.data;
      if (!data || typeof data !== "object" || !("type" in data) || data.type !== "alert") return;
      if (!("url" in data) || data.url !== `/messages/${conversationId}`) return;
      lastChange.current = Date.now();
      const label = "tag" in data && typeof data.tag === "string" ? liveLabel(data.tag, name.current) : null;
      if (label) {
        // One strip for a burst of alerts: it takes the latest sentence and stays up until the page has caught up.
        waiting.current = true;
        window.clearTimeout(doneTimer.current);
        window.clearTimeout(capTimer.current);
        setStatus({ open: true, done: false, text: label });
        capTimer.current = window.setTimeout(() => {
          waiting.current = false;
          setStatus((s) => ({ ...s, open: false }));
        }, CAP_MS);
      }
      refresh(true);
      window.clearTimeout(second);
      second = window.setTimeout(() => refresh(true), AGAIN_MS);
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.clearTimeout(second);
    };
  }, [conversationId, refresh]);

  // Nothing outlives the conversation on screen.
  useEffect(
    () => () => {
      window.clearTimeout(doneTimer.current);
      window.clearTimeout(capTimer.current);
    },
    [],
  );

  return status;
}
