"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { createPerkAction, updatePerkAction } from "./actions";
import { ErrorLine, Field, field, primary, quiet } from "./ui";

const digits = (value: string) => value.replace(/\D/g, "");

/** Adds a perk (live at once) to one shop. Closed it is one button. */
export function AddPerkForm({ partnerId, first }: { partnerId: string; first: boolean }) {
  const step = useAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [terms, setTerms] = useState("");
  const [limit, setLimit] = useState("");
  const [period, setPeriod] = useState("day");
  const [total, setTotal] = useState("");
  const [endsAt, setEndsAt] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={first ? primary : quiet}>
        Add a perk
      </button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
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
            setOpen(false);
          },
        );
      }}
    >
      <h3 className="text-sm font-semibold">New perk</h3>
      <Field label="Title" hint="For example “Buy 5 get 1 free”.">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} required />
      </Field>
      <Field label="Terms" hint="What the cashier should know. The student reads this too.">
        <textarea value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={500} rows={2} className={`${field} h-auto py-2`} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Uses per student" hint="Empty = no limit.">
          <input value={limit} onChange={(e) => setLimit(digits(e.target.value))} inputMode="numeric" className={field} />
        </Field>
        <Field label="Per">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={field} disabled={limit === ""}>
            <option value="day">day</option>
            <option value="week">week</option>
            <option value="month">month</option>
            <option value="ever">forever</option>
          </select>
        </Field>
        <Field label="Total available" hint="Empty = unlimited.">
          <input value={total} onChange={(e) => setTotal(digits(e.target.value))} inputMode="numeric" className={field} />
        </Field>
        <Field label="Ends on" hint="Empty = no end date.">
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={field} />
        </Field>
      </div>
      <ErrorLine message={step.error} />
      <div className="flex gap-2">
        <button type="submit" disabled={step.busy} className={`${primary} flex-1`}>
          {step.busy ? "Adding…" : "Add perk"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={quiet}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-zinc-500">The limit can’t be changed later. To change it, end this perk and add a new one.</p>
    </form>
  );
}

/** Edit a perk's title, terms, total available and end date. */
export function EditPerkForm({ perkId, title: t, terms: tm, totalQuantity, endsAt: end }: { perkId: string; title: string; terms: string; totalQuantity: number | null; endsAt: string }) {
  const step = useAction();
  const [title, setTitle] = useState(t);
  const [terms, setTerms] = useState(tm);
  const [total, setTotal] = useState(totalQuantity === null ? "" : String(totalQuantity));
  const [endsAt, setEndsAt] = useState(end);
  const unchanged = title === t && terms === tm && total === (totalQuantity === null ? "" : String(totalQuantity)) && endsAt === end;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void step.run(() => updatePerkAction(perkId, { title, terms, totalQuantity: total, endsAt }));
      }}
    >
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={field} required />
      </Field>
      <Field label="Terms">
        <textarea value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={500} rows={2} className={`${field} h-auto py-2`} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total available" hint="Empty = unlimited.">
          <input value={total} onChange={(e) => setTotal(digits(e.target.value))} inputMode="numeric" className={field} />
        </Field>
        <Field label="Ends on" hint="Empty = no end date.">
          <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={field} />
        </Field>
      </div>
      <ErrorLine message={step.error} />
      <button type="submit" disabled={step.busy || unchanged} className={primary}>
        {step.busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
