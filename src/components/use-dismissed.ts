"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a card was dismissed on this device, kept in localStorage under `key`. `dismiss` hides it for good and every
 * copy of the card on the page reacts. On the server it reads as dismissed, so the card appears only once the page is in
 * the browser and never flashes for someone who already dismissed it.
 */
export function useDismissed(key: string): { dismissed: boolean; dismiss: () => void } {
  const event = `dismissed:${key}`;
  const dismissed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(event, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(event, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );

  function dismiss() {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage is blocked: the card still goes away until the next visit.
    }
    window.dispatchEvent(new Event(event));
  }
  return { dismissed, dismiss };
}
