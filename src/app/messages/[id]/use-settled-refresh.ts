"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useTransition } from "react";

// If the refreshed page has not arrived by now, the buttons are freed anyway.
const GIVE_UP_MS = 10_000;

/**
 * Refreshes the page after a step succeeded and calls `onSettled` once the new page has arrived, so a button can
 * keep saying "Confirming…" until the screen shows the result, never flicker back to the old state.
 */
export function useSettledRefresh(onSettled: () => void): () => void {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const waiting = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(onSettled);
  useEffect(() => {
    latest.current = onSettled;
  });

  const done = useCallback(() => {
    if (!waiting.current) return;
    waiting.current = false;
    window.clearTimeout(timer.current);
    latest.current();
  }, []);

  useEffect(() => {
    if (!pending) done();
  }, [pending, done]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return useCallback(() => {
    waiting.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(done, GIVE_UP_MS);
    startTransition(() => router.refresh());
  }, [router, done]);
}
