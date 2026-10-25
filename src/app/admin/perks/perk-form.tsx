"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { createPerkAction, updatePerkAction } from "./actions";

const field = "h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700";
const button = "h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-50";

/** Adds a perk (live at once) to one partner. */
export function AddPerkForm({ partnerId }: { partnerId: string }) {
  const step = useAction();
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [limit, setLimit] = useState("");
  const [period, setPeriod] = useState("day");
  const [total, setTotal] = useState("");
  const [endsAt, setEndsAt] = useState("");

  return (
    <form
      className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800"
      onSubmit={(event) => {
        event.preventDefault();
        void step.run(
          () => createPerkAction({ partnerId, title, terms, limitPerStudent: limit, limitPeriod: period, totalQuantity: total, endsAt }),
          () => {
            setTitle("");
            setTerms("");
            setLimit("");
            setTotal("");
            setEndsAt("");
          },
        );
      }}
    >
      <h3 className="text-sm font-semibold">Add a perk</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title, e.g. Buy 5 get 1 free" aria-label="Perk title" maxLength={120} className={field} required />
      <textarea value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Terms the student sees" aria-label="Terms" maxLength={500} rows={2} className={`${field} h-auto py-2`} required />
      <div className="grid grid-cols-2 gap-2">
        <input value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Limit per student" aria-label="Limit per student" className={field} />
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Limit period" className={field} disabled={limit === ""}>
          <option value="day">a day</option>
          <option value="week">a week</option>
          <option value="month">a month</option>
          <option value="ever">in total</option>
        </select>
        <input value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Total quantity" aria-label="Total quantity" className={field} />
        <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-label="Ends on" className={field} />
      </div>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      <button type="submit" disabled={step.busy} className={button}>
        {step.busy ? "Adding…" : "Add perk"}
      </button>
    </form>
  );
}

/** Edit a perk's title, terms, total quantity and end date. */
export function EditPerkForm({ perkId, title: t, terms: tm, totalQuantity, endsAt: end }: { perkId: string; title: string; terms: string; totalQuantity: number | null; endsAt: string }) {
  const step = useAction();
  const [title, setTitle] = useState(t);
  const [terms, setTerms] = useState(tm);
  const [total, setTotal] = useState(totalQuantity === null ? "" : String(totalQuantity));
  const [endsAt, setEndsAt] = useState(end);
  const unchanged = title === t && terms === tm && total === (totalQuantity === null ? "" : String(totalQuantity)) && endsAt === end;
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void step.run(() => updatePerkAction(perkId, { title, terms, totalQuantity: total, endsAt }));
      }}
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Perk title" maxLength={120} className={field} required />
      <textarea value={terms} onChange={(e) => setTerms(e.target.value)} aria-label="Terms" maxLength={500} rows={2} className={`${field} h-auto py-2`} required />
      <div className="grid grid-cols-2 gap-2">
        <input value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="Total quantity" aria-label="Total quantity" className={field} />
        <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-label="Ends on" className={field} />
      </div>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      <button type="submit" disabled={step.busy || unchanged} className={button}>
        {step.busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
