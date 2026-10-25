"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { PERK_KINDS } from "@/lib/perks/kinds";
import { createPartnerAction, updatePartnerAction } from "./actions";

const field = "h-11 w-full min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700";
const button = "h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-50";

/** Adds a partner: name, what it sells, area, which schools (none ticked = every school), and an optional PIN. */
export function AddPartnerForm({ schools }: { schools: { domain: string; name: string }[] }) {
  const step = useAction();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [kind, setKind] = useState<string>(PERK_KINDS[0].id);
  const [pin, setPin] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [made, setMade] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
      onSubmit={(event) => {
        event.preventDefault();
        setMade(null);
        let newPin = "";
        void step.run(
          async () => {
            const result = await createPartnerAction({ name, area, kind, pin, schoolDomains: domains });
            if (result.ok) newPin = result.pin;
            return result;
          },
          () => {
            setMade(newPin);
            setName("");
            setArea("");
            setPin("");
            setDomains([]);
          },
        );
      }}
    >
      <h2 className="text-base font-semibold">Add a partner</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop name" aria-label="Shop name" maxLength={120} className={field} required />
      <div className="flex flex-col gap-3 sm:flex-row">
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="What it sells" className={field}>
          {PERK_KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
        <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Area, e.g. Near the main gate" aria-label="Area" maxLength={120} className={field} required />
      </div>
      <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="PIN (4 digits, empty = make one)" aria-label="PIN" className={field} />
      {schools.length > 0 ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm text-zinc-600 dark:text-zinc-400">Schools it serves (none ticked = every school)</legend>
          {schools.map((s) => (
            <label key={s.domain} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={domains.includes(s.domain)}
                onChange={(e) => setDomains((current) => (e.target.checked ? [...current, s.domain] : current.filter((d) => d !== s.domain)))}
                className="h-5 w-5"
              />
              {s.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      {made ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Added. Its PIN is <strong className="font-mono text-base">{made}</strong>. Tell the shop.
        </p>
      ) : null}
      <button type="submit" disabled={step.busy} className={button}>
        {step.busy ? "Adding…" : "Add partner"}
      </button>
    </form>
  );
}

/** Edit a partner's name and area. */
export function EditPartnerForm({ partnerId, name: initialName, area: initialArea }: { partnerId: string; name: string; area: string }) {
  const step = useAction();
  const [name, setName] = useState(initialName);
  const [area, setArea] = useState(initialArea);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void step.run(() => updatePartnerAction(partnerId, { name, area }));
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Shop name" maxLength={120} className={field} required />
      <input value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area" maxLength={120} className={field} required />
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      <button type="submit" disabled={step.busy || (name === initialName && area === initialArea)} className={button}>
        {step.busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
