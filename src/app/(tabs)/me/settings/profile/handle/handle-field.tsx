"use client";

import { useState } from "react";
import { FloatingField } from "@/components/floating-field";
import { PageHeader } from "@/components/page-header";
import { checkHandle, HANDLE_CHANGE_DAYS, HANDLE_MAX, HANDLE_MIN, HANDLE_PROBLEM_MESSAGE } from "@/lib/identity/names";
import { checkHandleAction } from "../../actions";
import { EDIT_PROFILE, normalizeHandle, useDraft, useLeave } from "../draft";

/**
 * The Handle page: one field. Done checks the handle is well formed and free, then keeps it in the Edit profile draft;
 * nothing is saved until Save there (which checks again).
 */
export function HandleField() {
  const draft = useDraft();
  const leave = useLeave(EDIT_PROFILE);
  const locked = draft.initial.handleChangeOn !== null;
  const [value, setValue] = useState(draft.handle);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const changed = normalizeHandle(value) !== normalizeHandle(draft.handle);

  async function done(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (!changed || locked || checking) return;
    const checked = checkHandle(value);
    if (!checked.ok) {
      setError(HANDLE_PROBLEM_MESSAGE[checked.problem]);
      return;
    }
    setChecking(true);
    try {
      const result = await checkHandleAction(checked.handle);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      draft.setHandle(result.handle);
      leave();
    } catch {
      setError("Could not check that handle. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Handle"
        back={EDIT_PROFILE}
        action={
          <button type="submit" form="handle-form" disabled={!changed || locked || checking} className="press flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-base font-semibold text-brand-text disabled:text-zinc-400 disabled:dark:text-zinc-600">
            {checking ? "Checking…" : "Done"}
          </button>
        }
      />
      <main className="mx-auto w-full max-w-md flex-1">
        <form id="handle-form" onSubmit={done}>
          <FloatingField
            label="Handle"
            prefix="@"
            value={value}
            onChange={(next) => {
              setValue(next);
              setError(null);
            }}
            disabled={locked}
            error={error}
            helper={
              locked
                ? `You can change your handle again on ${draft.initial.handleChangeOn}.`
                : `${HANDLE_MIN} to ${HANDLE_MAX} characters: letters a–z, numbers, dots and underscores. You can change your handle once every ${HANDLE_CHANGE_DAYS} days.`
            }
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            maxLength={HANDLE_MAX + 1}
            autoFocus={!locked}
          />
        </form>
      </main>
    </>
  );
}
