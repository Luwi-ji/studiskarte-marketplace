"use client";

import { useSyncExternalStore } from "react";

const EVENT = "studiskarte:device-value";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A text value remembered on this device only (localStorage). Null on the server and when nothing is saved or storage is blocked. */
export function useDeviceValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/** Saves a value on this device, or forgets it with null. Components using it update at once. */
export function setDeviceValue(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage is blocked: nothing is remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}
