"use client";

import { useState } from "react";
import { SettingsRow } from "@/components/settings-list";
import { signOut } from "@/app/(public)/sign-in/actions";
import { removeAlertsAction } from "@/app/notifications/actions";
import { currentSubscription } from "@/lib/notifications/push/device";

// Dropping the device is a courtesy: signing out never waits longer than this for it.
const SIGN_OUT_WAIT_MS = 3000;

/** Removes this device's alert subscription (here and at the push service). */
async function dropThisDevice(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await removeAlertsAction(sub.endpoint);
  await sub.unsubscribe();
}

/**
 * Signs out, then reloads the sign-in page in full. Next.js keeps visited
 * pages in memory; a full reload clears them, so the next person on a shared
 * phone cannot see the previous student's screens (Next.js docs: logout flows).
 */
export function SignOutRow() {
  const [busy, setBusy] = useState(false);
  return (
    <SettingsRow
      plain
      danger
      label={busy ? "Signing out…" : "Sign out"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // Alerts for this device stop with the session, while we can still say so as this student.
          // Signing out never waits on this: a failure here must not leave the student signed in.
          await Promise.race([dropThisDevice().catch(() => {}), new Promise((resolve) => setTimeout(resolve, SIGN_OUT_WAIT_MS))]);
          await signOut();
        } finally {
          // A full reload on purpose: client navigation would keep signed-in pages in memory.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/sign-in");
        }
      }}
    />
  );
}
