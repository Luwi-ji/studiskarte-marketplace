"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";

// The small pieces the post form is built from. The rows and sheets look and behave like the feed's Filters:
// a row with the value muted on the right and a chevron, opening a bottom sheet with a title and a close button.

export const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
export const labelClass = "text-sm font-medium";
export const hintClass = "text-xs text-zinc-500";

export function FieldError({ message, id }: { message?: string; id?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-sm text-red-600">
      {message}
    </p>
  ) : null;
}

const icon = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function ChevronIcon({ className = "h-5 w-5 shrink-0 text-zinc-500" }: { className?: string }) {
  return (
    <svg {...icon} className={className}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...icon} className="h-6 w-6">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...icon} className="h-6 w-6 shrink-0 text-brand-text">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

/** A bordered list of rows that share one frame, hairlines between them. */
export function RowGroup({ children, invalid = false }: { children: ReactNode; invalid?: boolean }) {
  return (
    <ul className={`flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border dark:divide-zinc-800 ${invalid ? "border-red-600" : "border-zinc-300 dark:border-zinc-700"}`}>
      {children}
    </ul>
  );
}

/** One row that opens a sheet: the label at the left, what is chosen muted at the right, then a chevron. */
export function DrillRow({
  id,
  label,
  value,
  onOpen,
  describedBy,
}: {
  /** Names the row for focus return: `data-sheet-row`. */
  id: string;
  label: string;
  value: ReactNode;
  onOpen: () => void;
  describedBy?: string;
}) {
  return (
    <li>
      <button
        type="button"
        data-sheet-row={id}
        aria-haspopup="dialog"
        aria-describedby={describedBy}
        onClick={onOpen}
        className="press-row flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left"
      >
        <span className="min-w-0 flex-1 text-base font-medium leading-snug">{label}</span>
        <span className="flex max-w-[50%] shrink-0 items-center gap-2 text-base text-zinc-500">
          <span className="flex min-w-0 items-center gap-2 truncate">{value}</span>
          <ChevronIcon />
        </span>
      </button>
    </li>
  );
}

const hairline = "border-b border-zinc-200 dark:border-zinc-800";

/**
 * A bottom sheet with the Filters' header (close at the left, the title in the middle) and a Done button at the foot.
 * `done={false}` leaves the foot off, for a list where choosing an answer closes the sheet by itself.
 */
export function FormSheet({
  id,
  open,
  onOpenChange,
  title,
  tall = false,
  done = true,
  children,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tall?: boolean;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} label={title} returnFocusTo={`[data-sheet-row="${id}"]`}>
      <div className={`flex min-h-0 flex-col ${tall ? "h-[85dvh]" : ""}`}>
        <div data-sheet-drag className={`grid shrink-0 touch-none grid-cols-[5rem_1fr_5rem] items-center px-2 ${hairline}`}>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={`Close ${title.toLowerCase()}`} className="flex h-11 w-11 items-center justify-center rounded-full">
            <BackIcon />
          </button>
          <h2 className="text-center text-lg font-semibold">{title}</h2>
          <span />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {done ? (
          <div className="shrink-0 border-t border-zinc-200 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800">
            <button type="button" onClick={() => onOpenChange(false)} className="h-12 w-full rounded-lg bg-brand text-base font-semibold text-white active:bg-brand-strong">
              Done
            </button>
          </div>
        ) : (
          <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </BottomSheet>
  );
}

const choiceRow = `press-row flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left text-base ${hairline}`;

/** A list of answers, one allowed. Picking one chooses it and closes the sheet. */
export function ChoiceList({
  name,
  options,
  value,
  onPick,
}: {
  name: string;
  options: { value: string; label: string; hint?: string }[];
  value: string;
  onPick: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onPick(option.value)} className={choiceRow}>
          <span className="flex min-w-0 flex-col">
            <span className={value === option.value ? "font-semibold text-brand-text" : ""}>{option.label}</span>
            {option.hint ? <span className="text-sm text-zinc-500">{option.hint}</span> : null}
          </span>
          {value === option.value ? <CheckIcon /> : null}
        </button>
      ))}
    </div>
  );
}

/** A checkbox row in a sheet: 44 px tall at least, with an optional line of help under the label. */
export function CheckRow({ label, hint, checked, onChange, name }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (checked: boolean) => void; name?: string }) {
  return (
    <label className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 px-4 py-2 text-base ${hairline}`}>
      <span className="flex min-w-0 flex-col">
        <span>{label}</span>
        {hint ? <span className="text-sm text-zinc-500">{hint}</span> : null}
      </span>
      <input className="h-5 w-5 shrink-0" type="checkbox" name={name} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
