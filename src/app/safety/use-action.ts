"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

/** Shown when a request did not get an answer at all, often because the app was updated while this page stayed open. */
const NO_ANSWER = "Could not reach the app. If it was just updated, reload the page and try again.";

/** Runs a server action with busy and error state, then keeps the control busy until the refreshed page arrives. */
export function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false);
  useEffect(() => {
    if (!pending && refreshing.current) {
      refreshing.current = false;
      setBusy(false);
    }
  }, [pending]);

  /** `onOk` runs after a success; with `refreshPage` false the page is left as it is (the caller navigates or shows a message). */
  async function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void, refreshPage = true) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Could not do that.");
        setBusy(false);
        return;
      }
      onOk?.();
      if (refreshPage) {
        refreshing.current = true;
        startTransition(() => router.refresh());
      } else {
        setBusy(false);
      }
    } catch {
      setError(NO_ANSWER);
      setBusy(false);
    }
  }
  return { busy, error, run };
}
