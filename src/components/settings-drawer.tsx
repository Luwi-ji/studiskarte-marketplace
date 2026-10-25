"use client";

import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { RowChevron } from "@/components/settings-list";

/**
 * A Settings row that opens a sheet holding a longer list, so the page stays short. The rows inside are ordinary
 * Settings rows (links); choosing one leaves the page, which closes the sheet.
 */
export function SettingsDrawer({ icon, label, description, value, title, children }: { icon?: ReactNode; label: string; description?: ReactNode; value?: ReactNode; title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="press-row flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-base">
        {icon}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{label}</span>
          {description ? <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">{description}</span> : null}
        </span>
        {value ? <span className="max-w-[45%] shrink-0 truncate text-sm font-normal text-zinc-600 dark:text-zinc-400">{value}</span> : null}
        <RowChevron />
      </button>
      <BottomSheet open={open} onOpenChange={setOpen} label={title ?? label}>
        <div data-sheet-drag className="shrink-0 touch-none border-b border-zinc-200 px-4 pb-3 pt-1 text-center dark:border-zinc-800">
          <h2 className="text-lg font-semibold">{title ?? label}</h2>
        </div>
        {/* Choosing a row leaves the page, so the sheet closes with it. */}
        <div onClick={(event) => (event.target as HTMLElement).closest("a") && setOpen(false)} className="min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <ul>{children}</ul>
        </div>
      </BottomSheet>
    </li>
  );
}
