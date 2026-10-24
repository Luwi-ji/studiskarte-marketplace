"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { FriendlyPage, PRIMARY_BUTTON } from "@/components/friendly-page";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Shown only when the root layout itself fails. It reports the error and offers a reload.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <FriendlyPage
          title="Something went wrong"
          actions={
            <>
              <button type="button" onClick={reset} className={PRIMARY_BUTTON}>
                Try again
              </button>
              <button type="button" onClick={() => { window.location.href = "/"; }} className="press min-h-11 px-4 font-medium text-brand-text">
                Back to the feed
              </button>
            </>
          }
        >
          We have been told about it. Try again, and if it keeps happening come back in a little while.
        </FriendlyPage>
      </body>
    </html>
  );
}
