"use client";

import { useState } from "react";
import { FloatingField } from "@/components/floating-field";
import { PageHeader } from "@/components/page-header";
import { checkDisplayName, DISPLAY_NAME_MAX } from "@/lib/identity/names";
import { EDIT_PROFILE, useDraft, useLeave } from "../draft";

/** The Display name page: one field. Done keeps the name in the Edit profile draft; nothing is saved until Save there. */
export function NameField() {
  const draft = useDraft();
  const leave = useLeave(EDIT_PROFILE);
  const [value, setValue] = useState(draft.name);
  const [error, setError] = useState<string | null>(null);
  const changed = value.trim() !== draft.name.trim();

  function done(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (!changed) return;
    const checked = checkDisplayName(value);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    draft.setName(checked.name);
    leave();
  }

  return (
    <>
      <PageHeader
        title="Display name"
        back={EDIT_PROFILE}
        action={
          <button type="submit" form="name-form" disabled={!changed} className="press flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-base font-semibold text-brand-text disabled:text-zinc-400 disabled:dark:text-zinc-600">
            Done
          </button>
        }
      />
      <main className="mx-auto w-full max-w-md flex-1">
        <form id="name-form" onSubmit={done}>
          <FloatingField
            label="Display name"
            value={value}
            onChange={(next) => {
              setValue(next);
              setError(null);
            }}
            error={error}
            helper={`Use the name people know you by. Up to ${DISPLAY_NAME_MAX} characters, on one line. It shows on your profile and your posts; you can change it any time.`}
            autoComplete="nickname"
            enterKeyHint="done"
            autoFocus
          />
        </form>
      </main>
    </>
  );
}
