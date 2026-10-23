"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import type { TransactionAction, TransactionGroup } from "@/lib/deals/mine";
import { bulkTransactionsAction } from "./actions";

export type TransactionRow = {
  id: string;
  postId: string;
  title: string;
  kind: string;
  thumbUrl: string;
  otherName: string;
  otherHandle: string | null;
  quantity: number;
  amount: number;
  group: TransactionGroup;
  chip: string;
  state: string;
  action: TransactionAction | null;
  conversationId: string;
  at: string;
};

type Tab = "all" | TransactionGroup;
const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting" },
  { id: "active", label: "In progress" },
  { id: "done", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
  { id: "reported", label: "Reported" },
  { id: "ended", label: "Declined / expired" },
];
const ACTION: Record<TransactionAction, string> = { withdraw: "Withdraw", decline: "Decline", cancel: "Cancel" };
const KIND: Record<string, string> = { showcase: "bg-brand text-white", wishlist: "bg-amber-400 text-amber-950" };

function ChecklistIcon() {
  return <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6h11M9 12h11M9 18h11M3.5 6 5 7.5 7.5 4.5M3.5 12 5 13.5l2.5-3M3.5 18 5 19.5l2.5-3" /></svg>;
}

export function TransactionsView({ rows }: { rows: TransactionRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<TransactionAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const visible = tab === "all" ? rows : rows.filter((row) => row.group === tab);
  const selectedRows = visible.filter((row) => selected.has(row.id));
  const grouped = useMemo(() => TABS.slice(1).map((item) => ({ ...item, count: rows.filter((row) => row.group === item.id).length })), [rows]);
  const applicable = (action: TransactionAction) => selectedRows.filter((row) => row.action === action);

  function changeTab(next: Tab) {
    setTab(next);
    setSelected(new Set());
    setSelecting(false);
  }
  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
  async function run() {
    if (!confirm) return;
    const targets = applicable(confirm);
    setBusy(true);
    try {
      const result = await bulkTransactionsAction({ action: confirm, ids: targets.map((row) => row.id) });
      if (!result.ok) setToast(result.error);
      else {
        const changed = result.results.filter((row) => row.ok).length;
        const failed = result.results.length - changed;
        const past = { withdraw: "withdrawn", decline: "declined", cancel: "cancelled" }[confirm];
        setToast(`${changed} ${past}${failed ? `, ${failed} could not be changed` : ""}.`);
        setSelected(new Set());
        setSelecting(false);
      }
    } catch {
      setToast("Could not update those transactions. Try again.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 border-b border-zinc-200 bg-[var(--background)] dark:border-zinc-800">
        <div className="flex items-center justify-between px-3">
          <p className="text-sm font-medium">{selecting ? `${selectedRows.length} selected` : `${rows.length} transactions`}</p>
          {rows.some((row) => row.action) ? (
            <button type="button" aria-label={selecting ? "Cancel selection" : "Select transactions"} onClick={() => { setSelecting((value) => !value); setSelected(new Set()); }} className="press flex h-11 w-11 items-center justify-center rounded-full">
              {selecting ? <span aria-hidden className="text-2xl">×</span> : <ChecklistIcon />}
            </button>
          ) : null}
        </div>
        <nav aria-label="Transaction status" className="flex overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.filter((item) => item.id === "all" || grouped.find((group) => group.id === item.id)?.count).map((item) => {
            const count = item.id === "all" ? rows.length : grouped.find((group) => group.id === item.id)?.count ?? 0;
            return <button key={item.id} type="button" onClick={() => changeTab(item.id)} aria-current={tab === item.id ? "page" : undefined} className={`flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm ${tab === item.id ? "border-brand font-semibold text-brand-text" : "border-transparent text-zinc-500"}`}>{item.label}<span className="text-xs font-normal">{count}</span></button>;
          })}
        </nav>
      </div>

      {visible.length ? (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {visible.map((row) => {
            const checked = selected.has(row.id);
            const body = <><img src={row.thumbUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 font-medium leading-snug">{row.title}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND[row.kind] ?? KIND.showcase}`}>{row.kind === "wishlist" ? "Wishlist" : "Showcase"}</span></div><p className="truncate text-sm text-zinc-600 dark:text-zinc-400">₱{row.amount.toLocaleString("en-PH")} · {row.quantity} {row.quantity === 1 ? "item" : "items"}</p><p className="truncate text-xs text-zinc-500">{row.otherHandle ? `@${row.otherHandle}` : row.otherName} · {row.chip}</p><p className="line-clamp-2 text-xs text-zinc-500">{row.state}</p></div></>;
            return <li key={row.id}>{selecting ? <button type="button" disabled={!row.action} onClick={() => toggle(row.id)} aria-pressed={checked} className="flex min-h-24 w-full items-center gap-3 px-3 py-3 text-left disabled:opacity-50"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${checked ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`} aria-hidden>{checked ? "✓" : ""}</span>{body}</button> : <Link href={`/messages/${row.conversationId}`} className="press flex min-h-24 items-center gap-3 px-3 py-3">{body}</Link>}</li>;
          })}
        </ul>
      ) : <p className="px-6 py-16 text-center text-zinc-500">No {TABS.find((item) => item.id === tab)?.label.toLowerCase()} transactions.</p>}

      {selecting && selectedRows.length ? <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-200 bg-[var(--background)]/95 px-3 py-2 backdrop-blur dark:border-zinc-800"><div className="mx-auto flex max-w-md gap-2">{(["withdraw", "decline", "cancel"] as TransactionAction[]).map((action) => applicable(action).length ? <button key={action} type="button" onClick={() => setConfirm(action)} className="h-11 flex-1 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-red-600 dark:border-zinc-700">{ACTION[action]} {applicable(action).length}</button> : null)}</div></div> : null}

      <BottomSheet open={confirm !== null} onOpenChange={(open) => { if (!open && !busy) setConfirm(null); }} label={confirm ? `${ACTION[confirm]} transactions` : "Transactions"}>
        <div className="flex flex-col gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"><h2 className="text-lg font-semibold">{confirm ? `${ACTION[confirm]} ${applicable(confirm).length} ${applicable(confirm).length === 1 ? "transaction" : "transactions"}?` : "Transactions"}</h2><p className="text-sm text-zinc-600 dark:text-zinc-400">Only transactions that can still be changed are included. The same rules as the conversation apply.</p><div className="grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => setConfirm(null)} className="h-11 rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">Keep</button><button type="button" disabled={busy} onClick={() => void run()} className="h-11 rounded-lg bg-red-600 font-medium text-white disabled:opacity-60">{busy ? "Working…" : confirm ? ACTION[confirm] : "Continue"}</button></div></div>
      </BottomSheet>
      {toast ? <button type="button" onClick={() => setToast(null)} className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900">{toast}</button> : null}
    </>
  );
}
