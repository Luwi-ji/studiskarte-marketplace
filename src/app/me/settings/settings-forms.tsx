"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type ChangeEvent } from "react";
import { DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/identity/names";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { saveDisplayName, saveHandle, type FieldState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const button =
  "rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900";

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
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="displayName" className="text-sm font-medium">
        Display name
      </label>
      <div className="flex gap-2">
        <input
          id="displayName"
          name="displayName"
          defaultValue={state.value}
          required
          maxLength={DISPLAY_NAME_MAX * 4}
          className={input}
        />
        <button type="submit" disabled={pending} className={button}>
          Save
        </button>
      </div>
      <Status state={state} />
    </form>
  );
}

export function HandleForm({ current, nextChangeOn }: { current: string; nextChangeOn: string | null }) {
  const [state, action, pending] = useActionState<FieldState, FormData>(saveHandle, { value: current });
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
          defaultValue={state.value}
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={HANDLE_MAX + 1}
          disabled={nextChangeOn !== null && !state.saved}
          className={`${input} disabled:opacity-60`}
        />
        <button type="submit" disabled={pending || (nextChangeOn !== null && !state.saved)} className={button}>
          Save
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        {nextChangeOn
          ? `You can change your handle again on ${nextChangeOn}.`
          : "You can change your handle once every 30 days."}
      </p>
      <Status state={state} />
    </form>
  );
}

export function AvatarForm({ pictureUrl }: { pictureUrl: string | null }) {
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
        <div className="h-20 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" aria-label="No profile picture" />
      )}
      <div className="flex flex-col gap-1">
        <label className="cursor-pointer text-sm font-medium underline">
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
