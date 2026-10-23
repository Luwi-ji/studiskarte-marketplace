"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { canGoBackInApp, PageHeader } from "@/components/page-header";
import { ProfileAvatar, SettingsSection, SettingsRow } from "@/components/settings-list";
import { preparePhoto } from "@/lib/images/prepare-photo";
import { saveProfileAction } from "../actions";
import { SAVED_TOAST_KEY } from "../saved-toast";
import { useDraft } from "./draft";

const SETTINGS = "/me/settings";

/** What the avatar route said went wrong, or a plain fallback. */
async function uploadPicture(blob: Blob): Promise<string | null> {
  try {
    const body = new FormData();
    body.set("picture", blob, "picture.jpg");
    const response = await fetch("/api/me/avatar", { method: "POST", body });
    if (response.ok) return null;
    const reply: unknown = await response.json().catch(() => null);
    return reply && typeof reply === "object" && "error" in reply && typeof reply.error === "string" ? reply.error : "Could not save the picture. Try again.";
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}

/**
 * Edit profile. Everything here is staged in the layout's draft; Save is the only thing that writes to the server:
 * the name and handle through one action, then the picture through the upload route.
 */
export function EditProfile() {
  const router = useRouter();
  const draft = useDraft();
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [discarding, setDiscarding] = useState(false);

  // Closing the tab or reloading with unsaved changes asks first (the browser words the question).
  useEffect(() => {
    if (!draft.dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft.dirty]);

  function leave() {
    if (canGoBackInApp()) router.back();
    else router.replace(SETTINGS);
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPreparing(true);
    setErrors([]);
    try {
      const prepared = await preparePhoto(file);
      if (prepared) draft.setPicture(prepared);
      else setErrors(["Could not read that picture. Try another one."]);
    } catch {
      setErrors(["Could not read that picture. Try another one."]);
    } finally {
      input.value = "";
      setPreparing(false);
    }
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    try {
      const fields: { displayName?: string; handle?: string } = {};
      if (draft.nameChanged) fields.displayName = draft.name;
      if (draft.handleChanged) fields.handle = draft.handle;
      if (fields.displayName !== undefined || fields.handle !== undefined) {
        const result = await saveProfileAction(fields);
        if (!result.ok) {
          setErrors([result.errors.displayName && `Display name: ${result.errors.displayName}`, result.errors.handle && `Handle: ${result.errors.handle}`].filter((line): line is string => Boolean(line)));
          return;
        }
      }
      if (draft.picture) {
        const problem = await uploadPicture(draft.picture.blob);
        if (problem) {
          setErrors([`${fields.displayName !== undefined || fields.handle !== undefined ? "Your changes are saved, but the picture is not. " : ""}${problem}`]);
          return;
        }
        // Uploading does not refresh the pages by itself; this does, with nothing to change.
        await saveProfileAction({});
      }
      window.sessionStorage.setItem(SAVED_TOAST_KEY, "Profile saved");
      leave();
    } catch {
      setErrors(["Could not save. Check your connection and try again."]);
    } finally {
      setSaving(false);
    }
  }

  const src = draft.picture?.previewUrl ?? draft.initial.pictureUrl;

  return (
    <>
      <PageHeader
        title="Edit profile"
        back={SETTINGS}
        onBack={() => (draft.dirty ? setDiscarding(true) : leave())}
        action={
          <button
            type="button"
            onClick={() => void save()}
            disabled={!draft.dirty || saving || preparing}
            className="press flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-base font-semibold text-brand-text disabled:text-zinc-400 disabled:dark:text-zinc-600"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />
      <main className="mx-auto w-full max-w-md flex-1 pb-6">
        <div className="flex flex-col items-center gap-1 px-4 pb-4 pt-6">
          <ProfileAvatar src={src} name={draft.name} size="lg" />
          <label className="press-row flex h-11 cursor-pointer items-center rounded-lg px-4 text-base font-medium text-brand-text has-[:disabled]:opacity-60">
            {preparing ? "Reading picture…" : draft.picture || draft.initial.pictureUrl ? "Change picture" : "Add a picture"}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} disabled={preparing || saving} className="sr-only" />
          </label>
        </div>

        <SettingsSection>
          <SettingsRow href="/me/settings/profile/name" label="Display name" value={draft.name.trim()} />
          <SettingsRow href="/me/settings/profile/handle" label="Handle" value={`@${draft.handle.trim().replace(/^@/, "").toLowerCase()}`} />
        </SettingsSection>
        <p className="px-4 pt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {draft.initial.handleChangeOn ? `You can change your handle again on ${draft.initial.handleChangeOn}.` : "You can change your handle once every 30 days."} Changes are saved when you tap Save.
        </p>

        {errors.length > 0 ? (
          <ul role="alert" className="mx-4 mt-4 flex flex-col gap-1 text-sm text-red-600 dark:text-red-400">
            {errors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </main>

      <ConfirmSheet
        open={discarding}
        onOpenChange={setDiscarding}
        title="Discard changes?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setDiscarding(false);
          leave();
        }}
      >
        Your changes to your profile have not been saved.
      </ConfirmSheet>
    </>
  );
}
