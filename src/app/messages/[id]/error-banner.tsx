"use client";

import { useEffect, useState } from "react";
import { ReloadButton } from "./reload-hint";

/**
 * Shows a script error on this page instead of letting it pass unseen. A tap
 * whose handler fails otherwise does nothing at all, with no message, which on a
 * phone is impossible to tell apart from a dead button.
 */
export function ErrorBanner() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const onError = (event: ErrorEvent) => setMessage(event.message || "Unknown error");
    const onRejection = (event: PromiseRejectionEvent) => setMessage(event.reason instanceof Error ? event.reason.message : String(event.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  if (!message) return null;
  return (
    <div role="alert" className="sticky top-[calc(3.5rem+env(safe-area-inset-top)+1px)] z-20 flex flex-col gap-2 bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-200">
      <p>Something went wrong on this page: {message.slice(0, 160)}</p>
      <div className="grid grid-cols-2 gap-2">
        <ReloadButton />
        <button type="button" onClick={() => setMessage(null)} className="h-11 rounded-lg border border-red-300 text-sm font-medium dark:border-red-900">
          Dismiss
        </button>
      </div>
    </div>
  );
}
