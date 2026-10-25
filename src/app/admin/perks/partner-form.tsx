"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { PERK_KINDS } from "@/lib/perks/kinds";
import { createPartnerAction, updatePartnerAction } from "./actions";
import { Chip, ErrorLine, Field, field, primary, quiet } from "./ui";

/** Adds a shop. Closed it is one button; open it asks four things (what, where, who can use it, PIN). */
export function AddPartnerForm({ schools }: { schools: { domain: string; name: string }[] }) {
  const step = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [kind, setKind] = useState<string>(PERK_KINDS[0].id);
  const [pin, setPin] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [made, setMade] = useState<{ name: string; pin: string } | null>(null);

  function toggleSchool(domain: string) {
    setDomains((current) => (current.includes(domain) ? current.filter((d) => d !== domain) : [...current, domain]));
  }

  return (
    <div className="flex flex-col gap-3">
      {made ? (
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          <strong>{made.name}</strong> added. Its PIN is <strong className="font-mono text-lg tracking-widest">{made.pin}</strong>. Tell the shop, then add its first perk below.
        </p>
      ) : null}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={primary}>
          Add a shop
        </button>
      ) : (
        <form
          className="flex flex-col gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
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
                setMade({ name, pin: newPin });
                setName("");
                setArea("");
                setPin("");
                setDomains([]);
                setOpen(false);
              },
            );
          }}
        >
          <h2 className="text-base font-semibold">Add a shop</h2>
          <Field label="Shop name">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} required />
          </Field>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">What it sells</span>
            <div className="flex flex-wrap gap-2">
              {PERK_KINDS.map((k) => (
                <Chip key={k.id} selected={kind === k.id} onClick={() => setKind(k.id)}>
                  {k.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="Where" hint="Shown to students, for example “Near the main gate”.">
            <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} className={field} required />
          </Field>
          {schools.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Who can use it</span>
              <div className="flex flex-wrap gap-2">
                <Chip selected={domains.length === 0} onClick={() => setDomains([])}>
                  All schools
                </Chip>
                {schools.map((s) => (
                  <Chip key={s.domain} selected={domains.includes(s.domain)} onClick={() => toggleSchool(s.domain)}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          <Field label="Shop PIN" hint="The cashier types it on the student’s phone. Leave empty and we make one.">
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} className={`${field} font-mono tracking-widest`} />
          </Field>
          <ErrorLine message={step.error} />
          <div className="flex gap-2">
            <button type="submit" disabled={step.busy} className={`${primary} flex-1`}>
              {step.busy ? "Adding…" : "Add shop"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={quiet}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Edit a shop's name and area. */
export function EditPartnerForm({ partnerId, name: initialName, area: initialArea }: { partnerId: string; name: string; area: string }) {
  const step = useAction();
  const [name, setName] = useState(initialName);
  const [area, setArea] = useState(initialArea);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void step.run(() => updatePartnerAction(partnerId, { name, area }));
      }}
    >
      <Field label="Shop name">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={field} required />
      </Field>
      <Field label="Where">
        <input value={area} onChange={(e) => setArea(e.target.value)} maxLength={120} className={field} required />
      </Field>
      <ErrorLine message={step.error} />
      <button type="submit" disabled={step.busy || (name === initialName && area === initialArea)} className={primary}>
        {step.busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
