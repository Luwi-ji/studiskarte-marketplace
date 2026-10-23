"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
  /** Red confirm button, for something that cannot be undone. */
  danger?: boolean;
};

/** A bottom sheet that asks one yes/no question: a title, a line or two, and two full-width buttons. */
export function ConfirmSheet({ open, onOpenChange, title, children, confirmLabel, cancelLabel, onConfirm, busy, error, danger }: Props) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} label={title}>
      <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        {children ? <div className="text-sm text-zinc-700 dark:text-zinc-300">{children}</div> : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`press flex h-12 w-full items-center justify-center rounded-lg font-medium text-white disabled:opacity-60 ${danger ? "bg-red-700" : "bg-brand"}`}
        >
          {confirmLabel}
        </button>
        <button type="button" disabled={busy} onClick={() => onOpenChange(false)} className="press flex h-12 w-full items-center justify-center rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
