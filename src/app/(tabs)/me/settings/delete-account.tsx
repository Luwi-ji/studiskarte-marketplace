"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { currentSubscription } from "@/lib/notifications/push/device";
import { deleteAccountAction } from "./actions";

/** Deleting the account: says what happens, asks for the handle, then reloads the sign-in page in full. */
export function DeleteAccount({ handle }: { handle: string }) {
  const step = useAction();
  const [typed, setTyped] = useState("");
  const matches = typed.trim().replace(/^@/, "").toLowerCase() === handle;

  return (
    <div className="flex flex-col gap-3 px-4 py-4 text-sm">
        <p className="text-zinc-700 dark:text-zinc-300">This is final and cannot be undone.</p>
        <ul className="list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
          <li>Your profile, handle, picture and school email are erased, and you are signed out everywhere.</li>
          <li>Your open listings are withdrawn.</li>
          <li>Reservations still being arranged are cancelled and the other student is told. One already paid or handed over is sent to an admin instead.</li>
          <li>Your messages and finished reservations stay for the other student, shown as &ldquo;Deleted account&rdquo;. They can no longer reply to you.</li>
          <li>You can sign up again later with the same email, as a new student.</li>
        </ul>
        <label htmlFor="deleteConfirm" className="font-medium">
          Type <span className="font-mono">@{handle}</span> to confirm
        </label>
        <input
          id="deleteConfirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="button"
          disabled={!matches || step.busy}
          className="h-12 w-full rounded-lg bg-red-700 font-medium text-white disabled:opacity-50"
          onClick={() =>
            void step.run(
              () => deleteAccountAction(typed),
              () => {
                // This device's alerts stop with the account; the server already removed the rows.
                void currentSubscription().then((sub) => sub?.unsubscribe()).catch(() => {});
                // A full reload on purpose: client navigation would keep signed-in pages in memory.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign("/sign-in");
              },
              false,
            )
          }
        >
          {step.busy ? "Deleting…" : "Delete my account for good"}
        </button>
        {step.error ? (
          <p role="alert" className="text-red-600">
            {step.error}
          </p>
        ) : null}
    </div>
  );
}
