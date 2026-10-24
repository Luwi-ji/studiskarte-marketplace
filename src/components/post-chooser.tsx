"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { DRAFT_EVENT, hasDraft } from "@/lib/posts/draft";
import type { PostKind } from "@/lib/posts/schema";

/** The two kinds of post and where each is made. Each has its own page. */
const CHOICES = [
  {
    kind: "showcase",
    href: "/posts/new/showcase",
    title: "Showcase",
    line: "I'm offering something",
    // A shopping bag.
    icon: "M6 7h12l1 13H5L6 7zM9 7a3 3 0 0 1 6 0",
  },
  {
    kind: "wishlist",
    href: "/posts/new/wishlist",
    title: "Wishlist",
    line: "I'm looking for something",
    // A magnifying glass.
    icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  },
] as const;

const row = "press-row flex min-h-20 w-full items-center gap-4 border-b border-zinc-200 px-4 py-3 text-left dark:border-zinc-800";

/** "Draft saved" under a kind when this device holds a draft of it for this student. Follows a draft saved or cleared in this tab or another. */
function DraftNote({ studentId, kind }: { studentId: string; kind: PostKind }) {
  const has = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(DRAFT_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(DRAFT_EVENT, onChange);
      };
    },
    () => hasDraft(studentId, kind),
    () => false,
  );
  return has ? <span className="text-sm text-zinc-500">Draft saved</span> : null;
}

function Rows({ canSell, studentId, onChoose }: { canSell: boolean; studentId?: string; onChoose?: () => void }) {
  return (
    <ul>
      {CHOICES.map((choice) => {
        const blocked = choice.kind === "showcase" && !canSell;
        const body = (
          <>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-text">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={choice.icon} />
              </svg>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-lg font-semibold">{choice.title}</span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{blocked ? "Only students can offer things" : choice.line}</span>
              {blocked || !studentId ? null : <DraftNote studentId={studentId} kind={choice.kind} />}
            </span>
            {blocked ? null : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5l7 7-7 7" />
              </svg>
            )}
          </>
        );
        return (
          <li key={choice.kind}>
            {blocked ? (
              <div aria-disabled="true" className={`${row} opacity-50`}>
                {body}
              </div>
            ) : (
              <Link href={choice.href} onClick={onChoose} className={row}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The bottom sheet the Create button opens: Showcase or Wishlist, each leading to its own page. */
export function PostChooserSheet({ open, onOpenChange, canSell = true, studentId, returnFocusTo }: { open: boolean; onOpenChange: (open: boolean) => void; canSell?: boolean; studentId?: string; returnFocusTo?: string }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} label="Create a post" returnFocusTo={returnFocusTo}>
      <div data-sheet-drag className="shrink-0 touch-none border-b border-zinc-200 px-4 pb-3 pt-1 text-center dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Create a post</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">What do you want to post?</p>
      </div>
      <div className="min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <Rows canSell={canSell} studentId={studentId} onChoose={() => onOpenChange(false)} />
      </div>
    </BottomSheet>
  );
}

/** The same two choices as a page's own content, for someone who opens the address directly. */
export function PostChoices({ canSell = true, studentId }: { canSell?: boolean; studentId?: string }) {
  return (
    <div className="-mx-4 border-t border-zinc-200 dark:border-zinc-800">
      <Rows canSell={canSell} studentId={studentId} />
    </div>
  );
}

/** A button that opens the chooser, for the places that say "Post your first item". Style it with `className`. */
export function NewPostButton({ className, canSell = true, children }: { className: string; canSell?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-haspopup="dialog" data-new-post-button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <PostChooserSheet open={open} onOpenChange={setOpen} canSell={canSell} returnFocusTo="[data-new-post-button]" />
    </>
  );
}
