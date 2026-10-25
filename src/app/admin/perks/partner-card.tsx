"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { perkKindLabel } from "@/lib/perks/kinds";
import { newPartnerPinAction, newReportLinkAction, setPartnerStatusAction, setPerkStatusAction } from "./actions";
import { EditPartnerForm } from "./partner-form";
import { AddPerkForm, EditPerkForm } from "./perk-form";

export type PerkCardData = {
  id: string;
  title: string;
  terms: string;
  status: string;
  limit: string | null;
  totalQuantity: number | null;
  /** YYYY-MM-DD in Manila, or "". */
  endsOn: string;
  endsLabel: string | null;
  claimed: number;
  redeemed: number;
  expired: number;
  conversion: number | null;
};
export type PartnerCardData = {
  id: string;
  name: string;
  kind: string;
  area: string;
  schools: string;
  status: string;
  pin: string | null;
  reportPath: string | null;
  perks: PerkCardData[];
};

const small = "h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";

function StatusButtons({ options, current, onPick, busy }: { options: string[]; current: string; onPick: (status: string) => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
      {options.map((status) => (
        <button key={status} type="button" disabled={busy || status === current} aria-pressed={status === current} onClick={() => onPick(status)} className={`${small} capitalize ${status === current ? "bg-zinc-100 dark:bg-zinc-900" : ""}`}>
          {status}
        </button>
      ))}
    </div>
  );
}

function PerkRow({ perk }: { perk: PerkCardData }) {
  const step = useAction();
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="font-medium">{perk.title}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{perk.terms}</p>
          <p className="text-xs text-zinc-500">{[perk.limit, perk.totalQuantity !== null ? `${perk.totalQuantity} in total` : null, perk.endsLabel ? `Until ${perk.endsLabel}` : null].filter(Boolean).join(" · ") || "No limit, no end date"}</p>
        </div>
        <button type="button" onClick={() => setEditing((was) => !was)} className={small}>
          {editing ? "Close" : "Edit"}
        </button>
      </div>
      <p className="text-sm">
        Claimed {perk.claimed} · Redeemed {perk.redeemed} · Expired {perk.expired} · Conversion {perk.conversion === null ? "–" : `${perk.conversion}%`}
      </p>
      {editing ? <EditPerkForm perkId={perk.id} title={perk.title} terms={perk.terms} totalQuantity={perk.totalQuantity} endsAt={perk.endsOn} /> : null}
      <StatusButtons options={["live", "paused", "ended"]} current={perk.status} busy={step.busy} onPick={(status) => void step.run(() => setPerkStatusAction(perk.id, status))} />
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
    </li>
  );
}

/** One partner: PIN, report link, status, edit, and its perks with their numbers. */
export function PartnerCard({ partner }: { partner: PartnerCardData }) {
  const status = useAction();
  const pin = useAction();
  const link = useAction();
  const [editing, setEditing] = useState(false);
  const [confirmLink, setConfirmLink] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!partner.reportPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${partner.reportPath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-base font-semibold">{partner.name}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {perkKindLabel(partner.kind)} · {partner.area}
          </p>
          <p className="text-xs text-zinc-500">{partner.schools}</p>
        </div>
        <button type="button" onClick={() => setEditing((was) => !was)} className={small}>
          {editing ? "Close" : "Edit"}
        </button>
      </div>
      {editing ? <EditPartnerForm partnerId={partner.id} name={partner.name} area={partner.area} /> : null}

      <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-500">Shop PIN</span>
          <span className="font-mono text-2xl font-bold tracking-widest">{partner.pin ?? "none"}</span>
        </div>
        <button type="button" disabled={pin.busy} onClick={() => void pin.run(() => newPartnerPinAction(partner.id))} className={small}>
          {pin.busy ? "Making…" : "New PIN"}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
        <span className="text-xs text-zinc-500">Report link (private; send it to the shop)</span>
        {partner.reportPath ? <code className="break-all text-xs">{partner.reportPath}</code> : <span className="text-sm text-zinc-500">No link yet.</span>}
        <div className="flex gap-2">
          {partner.reportPath ? (
            <button type="button" onClick={() => void copy()} className={small}>
              {copied ? "Copied" : "Copy link"}
            </button>
          ) : null}
          <button type="button" onClick={() => (partner.reportPath ? setConfirmLink(true) : void link.run(() => newReportLinkAction(partner.id)))} className={small}>
            {partner.reportPath ? "New link" : "Make link"}
          </button>
        </div>
      </div>
      <ConfirmSheet
        open={confirmLink}
        onOpenChange={setConfirmLink}
        title="Make a new link?"
        confirmLabel="Make new link"
        cancelLabel="Keep the old one"
        busy={link.busy}
        error={link.error}
        danger
        onConfirm={() => void link.run(() => newReportLinkAction(partner.id), () => setConfirmLink(false))}
      >
        The old link stops working at once. Send the new one to the shop.
      </ConfirmSheet>

      <StatusButtons options={["active", "paused", "ended"]} current={partner.status} busy={status.busy} onPick={(next) => void status.run(() => setPartnerStatusAction(partner.id, next))} />
      {status.error || pin.error ? (
        <p role="alert" className="text-sm text-red-600">
          {status.error ?? pin.error}
        </p>
      ) : null}

      {partner.perks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {partner.perks.map((perk) => (
            <PerkRow key={perk.id} perk={perk} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No perks yet.</p>
      )}
      <AddPerkForm partnerId={partner.id} />
      <p className="text-xs text-zinc-500">To change a perk&apos;s limit per student, end it and add a new one.</p>
    </section>
  );
}
