"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type ChangeEvent } from "react";
import { DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/identity/names";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { signOut } from "@/app/(public)/sign-in/actions";
import { removeAlertsAction } from "@/app/notifications/actions";
import { currentSubscription } from "@/lib/notifications/push/device";
import { saveDisplayName, saveHandle, type FieldState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const button =
  "rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white disabled:opacity-60";

function Status({ state }: { state: FieldState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {state.error}
      </p>
    );
  }
  return state.saved ? <p className="text-sm text-green-700 dark:text-green-400">Saved.</p> : null;
}

export function DisplayNameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<FieldState, FormData>(saveDisplayName, { value: current });
  const [typed, setTyped] = useState(current);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="displayName" className="text-sm font-medium">
        Display name
      </label>
      <div className="flex gap-2">
        <input
          id="displayName"
          name="displayName"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          required
          maxLength={DISPLAY_NAME_MAX * 4}
          className={input}
        />
        <button type="submit" disabled={pending || typed.trim() === state.value.trim()} className={button}>
          Save
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function HandleForm({ current, nextChangeOn }: { current: string; nextChangeOn: string | null }) {
  const [state, action, pending] = useActionState<FieldState, FormData>(saveHandle, { value: current });
  const [typed, setTyped] = useState(current);
  const unchanged = typed.trim().replace(/^@/, "").toLowerCase() === state.value;
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="handle" className="text-sm font-medium">
        Handle
      </label>
      <div className="flex items-center gap-2">
        <span className="text-zinc-500">@</span>
        <input
          id="handle"
          name="handle"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={HANDLE_MAX + 1}
          disabled={nextChangeOn !== null && !state.saved}
          className={`${input} disabled:opacity-60`}
        />
        <button type="submit" disabled={pending || unchanged || (nextChangeOn !== null && !state.saved)} className={button}>
          Save
        </button>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {nextChangeOn
          ? `You can change your handle again on ${nextChangeOn}.`
          : "You can change your handle once every 30 days."}
      </p>
      <Status state={state} />
    </form>
  );
}

/** Up to two capital letters for a picture-less avatar: the first letters of the first two words. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase())
    .join("");
}

export function AvatarForm({ pictureUrl, name }: { pictureUrl: string | null; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const prepared = await preparePhoto(file);
      if (!prepared) {
        setError("Could not read that picture. Try another one.");
        return;
      }
      const body = new FormData();
      body.set("picture", prepared, prepared === file ? file.name : "picture.jpg");
      const response = await fetch("/api/me/avatar", { method: "POST", body });
      if (!response.ok) {
        const reply: unknown = await response.json().catch(() => null);
        setError(
          reply && typeof reply === "object" && "error" in reply && typeof reply.error === "string"
            ? reply.error
            : "Could not save the picture. Try again.",
        );
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      input.value = "";
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {pictureUrl ? (
        // Signed, short-lived link; next/image would route private pictures through the optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pictureUrl} alt="Your profile picture" className="h-20 w-20 rounded-full object-cover" />
      ) : (
        <div role="img" aria-label="No profile picture" className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand/15 text-2xl font-semibold text-brand-text">
          <span aria-hidden>{initials(name)}</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="flex h-11 cursor-pointer items-center rounded-lg border border-zinc-400 px-4 text-sm font-medium dark:border-zinc-600">
          {busy ? "Uploading…" : pictureUrl ? "Change picture" : "Add a picture"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            disabled={busy}
            className="sr-only"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

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
export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
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
      className="flex h-12 w-full items-center justify-center rounded-lg border border-zinc-400 font-medium disabled:opacity-60 dark:border-zinc-600"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
