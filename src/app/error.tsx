"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { FriendlyPage, PRIMARY_BUTTON, SECONDARY_LINK } from "@/components/friendly-page";

// Shown when a page fails while rendering. Never shows the error itself; it is reported and the member can retry.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <FriendlyPage
      title="Something went wrong"
      actions={
        <>
          <button type="button" onClick={reset} className={PRIMARY_BUTTON}>
            Try again
          </button>
          <Link href="/" className={SECONDARY_LINK}>
            Back to the feed
          </Link>
        </>
      }
    >
      We have been told about it. Try again, and if it keeps happening come back in a little while.
    </FriendlyPage>
  );
}
