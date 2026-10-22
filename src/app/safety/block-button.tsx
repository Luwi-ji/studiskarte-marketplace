"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { blockPostOwnerAction, blockStudentAction, unblockStudentAction } from "./actions";
import { announceBlocked } from "./blocked-notice";
import { useAction } from "./use-action";

/** The Navigation API is not in every TypeScript DOM lib; `canGoBack` only counts entries of this site. */
type NavigationLike = { canGoBack: boolean };

/** True when going back stays inside the app. Browsers without the Navigation API fall back to history length. */
function canGoBackInApp(): boolean {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  return navigation ? navigation.canGoBack : window.history.length > 1;
}

/** Whom to block: a student by handle, or whoever posted a listing (for the "Report this post" screen). */
type BlockTarget = { handle: string; postId?: never } | { postId: string; handle?: never };

/**
 * Blocks a student after a bottom-sheet confirmation (the same pattern as the thread "⋯" menu), then goes back to
 * the previous screen, where "Blocked @name. Undo" shows for a few seconds. Their posts and profile are gone from view.
 */
export function BlockButton({ handle, postId, label = "Block", className }: BlockTarget & { label?: string; className?: string }) {
  const router = useRouter();
  const step = useAction();
  const sheet = useRef<HTMLDialogElement>(null);
  const name = handle ? `@${handle}` : "the person who posted this";

  function block() {
    let blocked = handle ?? "";
    void step.run(
      async () => {
        const result = postId ? await blockPostOwnerAction(postId) : await blockStudentAction(handle);
        if (result.handle) blocked = result.handle;
        return result;
      },
      () => {
        sheet.current?.close();
        announceBlocked(blocked);
        if (canGoBackInApp()) router.back();
        else router.push("/");
      },
      false,
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className={className ?? "h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"}
        onClick={() => sheet.current?.showModal()}
      >
        {label}
      </button>

      <dialog
        ref={sheet}
        aria-label={`Block ${name}`}
        className="m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-2xl bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
      >
        <div className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col">
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="min-w-0 truncate text-lg font-semibold">Block {name}?</h2>
            <button type="button" disabled={step.busy} onClick={() => sheet.current?.close()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl">
              ×
            </button>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              <li>You will not see each other&apos;s posts or profiles.</li>
              <li>The conversation becomes read-only.</li>
              <li>A reservation you are still arranging with them is cancelled. One that is already paid or agreed in cash stays.</li>
              <li>They are not told you blocked them.</li>
            </ul>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">You can undo this right after, or later in Settings under Blocked students.</p>
            {step.error ? (
              <p role="alert" className="text-sm text-red-600">
                {step.error}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={step.busy} onClick={() => sheet.current?.close()} className="h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700">
                Cancel
              </button>
              <button type="button" disabled={step.busy} onClick={block} className="h-11 rounded-lg border border-red-300 font-medium text-red-600 disabled:opacity-60 dark:border-red-900">
                {step.busy ? "Blocking…" : "Block"}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}

/** Lifts a block; the row it sits in disappears once the page refreshes. */
export function UnblockButton({ handle }: { handle: string }) {
  const step = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={step.busy}
        className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
        onClick={() => void step.run(() => unblockStudentAction(handle))}
      >
        {step.busy ? "Unblocking…" : "Unblock"}
      </button>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
    </div>
  );
}
