"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { bulkPostsAction } from "@/app/posts/bulk-actions";
import { PageHeader } from "@/components/page-header";
import { PendingResults, useNavigate, usePendingHref } from "@/components/pending-nav";
import { NewPostButton } from "@/components/post-chooser";
import { formatPrice, kindLabel } from "@/lib/posts/format";
import {
  BULK_ELIGIBLE,
  OWN_STATUS_LABEL,
  OWN_STATUSES,
  OWN_TYPE_LABEL,
  OWN_TYPES,
  ownViewHref,
  rowStatusLabel,
  viewOfHref,
  type BulkAction,
  type OwnCounts,
  type OwnStatus,
  type OwnView,
} from "@/lib/posts/own-view";
import { OwnPostsSkeleton } from "./skeleton";
import { STRIP_TOP, tabOff, tabOn } from "./strip-styles";

/** One post on the list, ready to show: the server has signed the photo and written the lines under the title. */
export type OwnRow = {
  id: string;
  kind: string;
  status: string;
  title: string;
  priceKind: string;
  priceAmount: number | null;
  cover: string;
  /** Short lines under the title: how long is left, views and hearts, how many are taken. */
  lines: { text: string; warn?: boolean }[];
  /** Offers or reservations are open, so the post cannot be edited. */
  editLocked: boolean;
};

type Props = {
  view: OwnView;
  counts: OwnCounts;
  rows: OwnRow[];
  usage: { open: number; max: number };
  /** How long a listing lasts, for the relist confirmation. */
  listingDays: number;
  /** How long an expired post waits for a relist before it is deleted. */
  expiredKeepDays: number;
  /** Only students can offer things; anyone can look for them. */
  canSell: boolean;
};

const NO_ANSWER = "Could not reach the app. If it was just updated, reload the page and try again.";
const TOAST_MS = 6000;

// The kind badge is the feed card's: Wishlist amber, Showcase brand blue, the full word.
const pill = "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold";
const KIND_PILL: Record<string, string> = { wishlist: "bg-amber-400 text-amber-950", showcase: "bg-brand text-white" };
const KIND_PRICE: Record<string, string> = { wishlist: "text-amber-700 dark:text-amber-300", showcase: "text-brand-text" };
// Meaning is in the word; the colour only helps.
const STATUS_PILL: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  reserved: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  fulfilled: "bg-brand/10 text-brand-text",
  expired: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  withdrawn: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  hidden: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  removed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
};

const PAST: Record<BulkAction, string> = { relist: "relisted", withdraw: "withdrawn", delete: "deleted" };
const ACTION_LABEL: Record<BulkAction, string> = { relist: "Relist", withdraw: "Withdraw", delete: "Delete" };
const DOING: Record<BulkAction, string> = { relist: "Relisting…", withdraw: "Withdrawing…", delete: "Deleting…" };

function plural(n: number, one: string) {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

function Icon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={path} />
    </svg>
  );
}

const CHECKLIST = "M9 6h11M9 12h11M9 18h11M3.5 6l1.5 1.5L7.5 4.5M3.5 12l1.5 1.5 2.5-3M3.5 18l1.5 1.5 2.5-3";

/** A link to a view that goes through the page's `PendingNav`, so the tab looks current at once and the list shows its skeleton if the new one is slow. */
function ViewLink({ view, current, className, children }: { view: OwnView; current: boolean; className: string; children: ReactNode }) {
  const go = useNavigate();
  const href = ownViewHref(view);
  return (
    <Link
      href={href}
      replace
      aria-current={current ? "page" : undefined}
      className={className}
      onNavigate={(event) => {
        event.preventDefault();
        if (!current) go(href, { replace: true });
      }}
    >
      {children}
    </Link>
  );
}

/** What the tapped tab will show, so the strip answers at once, before the page has loaded. */
function useShownView(view: OwnView): OwnView {
  const pending = usePendingHref();
  return (pending ? viewOfHref(pending) : null) ?? view;
}

/** Keeps the current pill in sight when the strip scrolls (a narrow phone). */
function useScrollToCurrent(shown: OwnStatus) {
  const strip = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = strip.current;
    const pill = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !pill) return;
    el.scrollLeft = Math.max(0, pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2);
  }, [shown]);
  return strip;
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-100 motion-reduce:transition-none ${checked ? "border-brand bg-brand text-white" : "border-zinc-400 bg-transparent dark:border-zinc-500"}`}
    >
      {checked ? <Icon path="M5 12.5l4.5 4.5L19 7.5" className="h-4 w-4" /> : null}
    </span>
  );
}

function RowBody({ row, selecting, checked }: { row: OwnRow; selecting: boolean; checked: boolean }) {
  const dim = row.status !== "open" && row.status !== "fulfilled";
  return (
    <>
      {selecting ? (
        <span className="-ml-1 flex h-11 w-9 shrink-0 items-center justify-center">
          <CheckBox checked={checked} />
        </span>
      ) : null}
      {/* Signed, short-lived link. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={row.cover} alt="" className={`h-20 w-20 shrink-0 rounded-lg object-cover ${dim ? "opacity-60" : ""}`} loading="lazy" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`${pill} ${KIND_PILL[row.kind] ?? KIND_PILL.showcase}`}>{kindLabel(row.kind)}</span>
          <span className={`${pill} ${STATUS_PILL[row.status] ?? STATUS_PILL.hidden}`}>{rowStatusLabel(row.status)}</span>
        </div>
        <p className={`truncate text-base font-bold ${KIND_PRICE[row.kind] ?? KIND_PRICE.showcase}`}>{formatPrice(row.priceKind, row.priceAmount)}</p>
        <p className="line-clamp-2 text-sm font-medium leading-snug">{row.title}</p>
        {row.lines.map((line) => (
          <p key={line.text} className={`text-xs ${line.warn ? "font-medium text-amber-700 dark:text-amber-400" : "text-zinc-500 dark:text-zinc-400"}`}>
            {line.text}
          </p>
        ))}
      </div>
      {selecting ? null : <Icon path="M9 6l6 6-6 6" className="h-5 w-5 text-zinc-400" />}
    </>
  );
}

const rowShell = "flex w-full items-center gap-3 rounded-xl p-2.5 text-left";

function Row({ row, selecting, checked, onToggle }: { row: OwnRow; selecting: boolean; checked: boolean; onToggle: () => void }) {
  return (
    <li className={`min-w-0 rounded-xl border bg-white transition-colors duration-100 motion-reduce:transition-none dark:bg-zinc-900 ${checked ? "border-brand-text bg-brand/5 dark:bg-brand/10" : "border-zinc-200/80 dark:border-zinc-800"}`}>
      {selecting ? (
        // The whole row is the checkbox, so the target is far bigger than 44 px.
        <label className={`${rowShell} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-text`}>
          <input type="checkbox" className="sr-only" checked={checked} onChange={onToggle} aria-label={`${row.title}, ${kindLabel(row.kind)}, ${rowStatusLabel(row.status)}`} />
          <RowBody row={row} selecting checked={checked} />
        </label>
      ) : (
        <Link href={`/posts/${row.id}`} className={`${rowShell} press-row`}>
          <RowBody row={row} selecting={false} checked={false} />
        </Link>
      )}
    </li>
  );
}

const EMPTY_HINT: Record<Exclude<OwnStatus, "all">, string> = {
  open: "Posts you create show here while they are listed.",
  reserved: "A post shows here while all of it is reserved.",
  fulfilled: "Posts show here once the handover is done.",
  expired: "A post shows here when its time runs out, so you can relist it.",
  withdrawn: "Posts you withdraw show here until they are removed.",
  hidden: "Posts hidden or removed during a review show here.",
};

function Empty({ view, total, counts, canSell }: { view: OwnView; total: number; counts: OwnCounts; canSell: boolean }) {
  const noun = view.type === "all" ? "posts" : `${OWN_TYPE_LABEL[view.type]} posts`;
  const go = useNavigate();
  const message =
    total === 0
      ? "You have not posted yet."
      : view.status === "all"
        ? `You have no ${noun} yet.`
        : `No ${OWN_STATUS_LABEL[view.status].toLowerCase()} ${noun}.`;
  const showAll = total > 0 && counts[view.type].all > 0;
  const allHref = ownViewHref({ type: view.type, status: "all" });
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex flex-col gap-1">
        <p className="text-zinc-700 dark:text-zinc-300">{message}</p>
        {view.status !== "all" ? <p className="text-sm text-zinc-500">{EMPTY_HINT[view.status]}</p> : null}
      </div>
      <NewPostButton canSell={canSell} className="press flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
        {total === 0 ? "Post your first item" : "Create a post"}
      </NewPostButton>
      {showAll ? (
        <Link
          href={allHref}
          replace
          onNavigate={(event) => {
            event.preventDefault();
            go(allHref, { replace: true });
          }}
          className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium dark:border-zinc-700"
        >
          Show all {noun}
        </Link>
      ) : null}
    </div>
  );
}

/** What a finished action did, in one line: "3 withdrawn, 1 could not be changed: a reservation is still being carried out." */
function summarize(action: BulkAction, results: { ok: boolean; reason?: string }[]): string {
  const done = results.filter((r) => r.ok).length;
  const failed = results.length - done;
  if (failed === 0) return `${done} ${PAST[action]}.`;
  const reasons = [...new Set(results.flatMap((r) => (r.ok || !r.reason ? [] : [r.reason])))].join("; ");
  const head = done === 0 ? `Nothing was ${PAST[action]}.` : `${done} ${PAST[action]},`;
  return `${head} ${failed} could not be changed: ${reasons}.`;
}

export function MyPostsView({ view, counts, rows, usage, listingDays, expiredKeepDays, canSell }: Props) {
  const shown = useShownView(view);
  const strip = useScrollToCurrent(shown.status);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirm, setConfirm] = useState<BulkAction>("withdraw");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const total = counts.all.all;
  const free = Math.max(0, usage.max - usage.open);
  // Only what is on screen counts: a post picked in another view and left behind is never acted on.
  const picked = rows.filter((r) => selected.has(r.id));
  const targets: Record<BulkAction, OwnRow[]> = {
    relist: picked.filter((r) => BULK_ELIGIBLE.relist.includes(r.status)),
    withdraw: picked.filter((r) => BULK_ELIGIBLE.withdraw.includes(r.status)),
    delete: picked.filter((r) => BULK_ELIGIBLE.delete.includes(r.status)),
  };
  const actionable = new Set([...targets.relist, ...targets.withdraw, ...targets.delete].map((r) => r.id));
  const stuck = picked.length - actionable.size;
  const single = picked.length === 1 ? picked[0] : null;
  const canEdit = single !== null && ["open", "reserved", "expired"].includes(single.status) && !single.editLocked;
  const allPicked = rows.length > 0 && picked.length === rows.length;

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setSheetOpen(false);
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      for (const r of rows) {
        if (allPicked) next.delete(r.id);
        else next.add(r.id);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (sheetOpen) setSheetOpen(false);
        else {
          setSelecting(false);
          setSelected(new Set());
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, sheetOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);


  function ask(action: BulkAction) {
    setConfirm(action);
    setError(null);
    setSheetOpen(true);
  }


  async function run() {
    const action = confirm;
    setBusy(true);
    setError(null);
    try {
      const response = await bulkPostsAction({ action, ids: targets[action].map((r) => r.id) });
      if (!response.ok) {
        setError(response.error);
        return;
      }
      setToast(summarize(action, response.results));
      stopSelecting();
    } catch {
      setError(NO_ANSWER);
    } finally {
      setBusy(false);
    }
  }

  const headerAction = selecting ? (
    <>
      <button type="button" onClick={toggleAll} disabled={rows.length === 0} className="h-11 shrink-0 rounded-lg px-2 text-sm font-medium text-brand-text disabled:opacity-50">
        {allPicked ? "Clear" : "Select all"}
      </button>
      <button type="button" onClick={stopSelecting} className="h-11 shrink-0 rounded-lg px-2 text-sm font-medium">
        Cancel
      </button>
    </>
  ) : total > 0 ? (
    <button
      type="button"
      aria-label="Select posts"
      onClick={() => setSelecting(true)}
      className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
    >
      <Icon path={CHECKLIST} className="h-6 w-6" />
    </button>
  ) : null;

  const statusTabs = OWN_STATUSES.filter((s) => ["all", "open", "reserved", "fulfilled", "expired", "withdrawn"].includes(s) || counts[shown.type][s] > 0 || s === shown.status);
  const full = free === 0;

  return (
    <>
      <PageHeader title={selecting ? `${picked.length} selected` : "My posts"} logo={!selecting} action={headerAction} />

      {total > 0 ? (
        <div className={`sticky ${STRIP_TOP} z-10 border-b border-zinc-200 bg-[var(--background)] dark:border-zinc-800`}>
          <nav aria-label="Post type" className="mx-auto flex w-full max-w-3xl px-2">
            {OWN_TYPES.map((type) => (
              <ViewLink key={type} view={{ type, status: shown.status }} current={type === shown.type} className={type === shown.type ? tabOn : tabOff}>
                {OWN_TYPE_LABEL[type]}
                <span className="text-xs font-normal tabular-nums text-zinc-500 dark:text-zinc-400">{counts[type].all}</span>
              </ViewLink>
            ))}
          </nav>
        </div>
      ) : null}

      <main className={`mx-auto w-full max-w-3xl flex-1 px-3 py-3 ${selecting ? "pb-32" : ""}`}>
        <div className="flex flex-col gap-1">
          {total > 0 ? (
            <>
              <section aria-label="Open post slots" className="flex min-h-11 flex-col justify-center gap-1.5 px-1">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="font-semibold text-[var(--foreground)]">
                    {usage.open} of {usage.max}
                  </span>{" "}
                  open posts used · {free} free
                  {full ? ". Withdraw a post to free a slot." : ""}
                </p>
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className={`h-full rounded-full ${full ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${Math.min(100, (usage.open / usage.max) * 100)}%` }} />
                </div>
              </section>
              <nav ref={strip} aria-label="Post status" className="-mx-3 flex overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {statusTabs.map((status) => {
                  const current = status === shown.status;
                  return (
                    <ViewLink key={status} view={{ type: shown.type, status }} current={current} className="flex h-11 shrink-0 items-center px-1">
                      <span
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none ${current ? "bg-brand/10 font-semibold text-brand-text" : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"}`}
                      >
                        {OWN_STATUS_LABEL[status]}
                        <span className={`text-xs font-normal tabular-nums ${current ? "" : "text-zinc-500 dark:text-zinc-400"}`}>{counts[shown.type][status]}</span>
                      </span>
                    </ViewLink>
                  );
                })}
              </nav>
            </>
          ) : null}

          <PendingResults skeleton={<OwnPostsSkeleton />} className="pt-1">
            {rows.length === 0 ? (
              <Empty view={view} total={total} counts={counts} canSell={canSell} />
            ) : (
              <ul className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
                {rows.map((row) => (
                  <Row key={row.id} row={row} selecting={selecting} checked={selected.has(row.id)} onToggle={() => toggle(row.id)} />
                ))}
              </ul>
            )}
          </PendingResults>
        </div>
      </main>

      {selecting ? (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-[var(--background)]/95 backdrop-blur will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out dark:border-zinc-800 [html[data-tab-bar-hidden]_&]:translate-y-16">
          <div className="mx-auto flex max-w-md flex-col gap-1.5 px-3 py-2">
            {sheetOpen ? (
              <ConfirmBody
                action={confirm}
                targets={targets[confirm]}
                others={picked.length - targets[confirm].length}
                free={free}
                max={usage.max}
                listingDays={listingDays}
                expiredKeepDays={expiredKeepDays}
                busy={busy}
                error={error}
                onBack={() => setSheetOpen(false)}
                onConfirm={() => void run()}
              />
            ) : picked.length === 0 ? (
              <p className="py-2.5 text-center text-sm text-zinc-600 dark:text-zinc-400">Tap posts to choose them.</p>
            ) : (
              <>
                {stuck > 0 ? (
                  <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">
                    {plural(stuck, "selected post")} can&apos;t be changed here: finished and hidden posts stay as they are.
                  </p>
                ) : single && !canEdit && single.editLocked ? (
                  <p className="text-center text-xs text-zinc-600 dark:text-zinc-400">Editing is locked while offers or reservations are open.</p>
                ) : null}
                <div className="grid auto-cols-fr grid-flow-col gap-2">
                  {canEdit && single ? (
                    <Link href={`/posts/${single.id}/edit`} className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
                      Edit
                    </Link>
                  ) : null}
                  {targets.relist.length > 0 ? (
                    <button type="button" onClick={() => ask("relist")} className="press flex h-11 items-center justify-center rounded-lg bg-brand text-sm font-medium text-white">
                      Relist ({targets.relist.length})
                    </button>
                  ) : null}
                  {targets.withdraw.length > 0 ? (
                    <button type="button" onClick={() => ask("withdraw")} className="flex h-11 items-center justify-center rounded-lg border border-red-300 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400">
                      Withdraw ({targets.withdraw.length})
                    </button>
                  ) : null}
                  {targets.delete.length > 0 ? (
                    <button type="button" onClick={() => ask("delete")} className="flex h-11 items-center justify-center rounded-lg border border-red-300 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400">
                      Delete ({targets.delete.length})
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}


      {toast ? (
        <div
          role="status"
          className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center justify-between gap-2 rounded-xl bg-zinc-900 py-1 pl-4 pr-1 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          <span className="min-w-0 py-2">{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="h-11 shrink-0 rounded-lg px-3 font-medium underline">
            OK
          </button>
        </div>
      ) : null}
    </>
  );
}

const TITLES_SHOWN = 4;

/** The confirmation: how many, which posts, and what will happen, in plain words. */
function ConfirmBody({
  action,
  targets,
  others,
  free,
  max,
  listingDays,
  expiredKeepDays,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  action: BulkAction;
  targets: OwnRow[];
  others: number;
  free: number;
  max: number;
  listingDays: number;
  expiredKeepDays: number;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const n = targets.length;
  const openOnes = targets.filter((r) => r.status === "open").length;
  const reservedOnes = targets.filter((r) => r.status === "reserved").length;
  const points: string[] = [];
  if (action === "relist") {
    points.push(`They go back in the feed for ${listingDays} days, with the details they have now. Dates that have passed are dropped.`);
    points.push(
      n > free
        ? `Each uses one of your ${max} open slots. You have ${free} free, so only the first ${free} can be relisted; the rest stay expired. Expired posts are deleted after ${expiredKeepDays} days.`
        : `Each uses one of your ${max} open slots. You have ${free} free.`,
    );
  } else if (action === "withdraw") {
    points.push("They leave the feed for good and cannot be relisted. You can delete them from your list afterwards.");
    if (openOnes > 0) points.push(`${plural(openOnes, "open post")} will free ${plural(openOnes, "slot")}.`);
    if (reservedOnes > 0) points.push("A reserved post is only withdrawn once its reservations are finished or cancelled; those are skipped.");
  } else {
    points.push("They are removed from your list. Messages about them stay in your conversations.");
    points.push("This cannot be undone.");
  }
  const destructive = action !== "relist";
  const shownTitles = targets.slice(0, TITLES_SHOWN);

  return (
    <div key={action} className="flex max-h-[60dvh] min-h-0 flex-col gap-3 overflow-y-auto py-1 text-left motion-safe:animate-[step-in_180ms_ease-out]">
      <h2 className="text-lg font-semibold">
        {ACTION_LABEL[action]} {plural(n, "post")}?
      </h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <ul className="flex flex-col rounded-lg bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
        {shownTitles.map((r) => (
          <li key={r.id} className="truncate py-1.5">
            {r.title}
          </li>
        ))}
        {n > TITLES_SHOWN ? <li className="py-1.5 text-zinc-600 dark:text-zinc-400">and {n - TITLES_SHOWN} more</li> : null}
      </ul>
      {others > 0 ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{plural(others, "other selected post")} will not change.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={onBack} className="press h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700">
          Back
        </button>
        <button
          type="button"
          disabled={busy || n === 0}
          data-haptic={destructive ? "warning" : "success"}
          onClick={onConfirm}
          className={`h-11 rounded-lg font-medium disabled:opacity-60 ${destructive ? "border border-red-300 text-red-600 dark:border-red-900 dark:text-red-400" : "bg-brand text-white"}`}
        >
          {busy ? DOING[action] : ACTION_LABEL[action]}
        </button>
      </div>
    </div>
  );
}
