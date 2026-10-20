"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Shown only when the root layout itself fails. It reports the error and offers a reload.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p>We have been told about it. Reload the page to try again.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </body>
    </html>
  );
}
