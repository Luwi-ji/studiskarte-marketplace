"use client";

import { useEffect, useState } from "react";

/** Set by Edit profile right before it returns here, so a short "Profile saved" shows once. */
export const SAVED_TOAST_KEY = "settings-saved-toast";
const SHOW_MS = 2500;

export function SavedToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Read in a timer callback: the page renders the same on the server and the client first, then the toast appears.
    let hide: number | undefined;
    const show = window.setTimeout(() => {
      const text = window.sessionStorage.getItem(SAVED_TOAST_KEY);
      if (!text) return;
      window.sessionStorage.removeItem(SAVED_TOAST_KEY);
      setMessage(text);
      hide = window.setTimeout(() => setMessage(null), SHOW_MS);
    }, 0);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4">
      <p role="status" className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">
        {message}
      </p>
    </div>
  );
}
