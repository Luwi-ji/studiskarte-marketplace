"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { perkKindLabel } from "@/lib/perks/kinds";
import { newPartnerPinAction, newReportLinkAction, setPartnerStatusAction, setPerkStatusAction } from "./actions";
import { EditPartnerForm } from "./partner-form";
import { AddPerkForm, EditPerkForm } from "./perk-form";
import { ErrorLine, Stats } from "./ui";

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

const small = "h-11 shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";
const PILL: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  live: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ended: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function Pill({ status }: { status: string }) {
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PILL[status] ?? PILL.ended}`}>{status}</span>;
}

/** Pick one status: a row of equal buttons, the current one filled. */
function StatusButtons({ options, current, onPick, busy }: { options: string[]; current: string; onPick: (status: string) => void; busy: boolean }) {
  return (
    <div className="flex gap-1 rounded-xl border border-zinc-300 p-1 dark:border-zinc-700" role="group" aria-label="Status">
      {options.map((status) => (
        <button
          key={status}
          type="button"
          disabled={busy || status === current}
          aria-pressed={status === current}
          onClick={() => onPick(status)}
          className={`h-9 flex-1 rounded-lg text-sm font-medium capitalize ${status === current ? "bg-brand text-white" : "disabled:opacity-50"}`}
        >
          {status}
        </button>
      ))}
    </div>
  );
}

function PerkRow({ perk }: { perk: PerkCardData }) {
  const step = useAction();
  const [editing, setEditing] = useState(false);
  const meta = [perk.limit, perk.totalQuantity !== null ? `${perk.totalQuantity} available` : null, perk.endsLabel ? `until ${perk.endsLabel}` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="font-semibold">{perk.title}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{perk.terms}</p>
          <p className="text-xs text-zinc-500">{meta || "No limit, no end date"}</p>
        </div>
        <Pill status={perk.status} />
      </div>
      <Stats claimed={perk.claimed} redeemed={perk.redeemed} expired={perk.expired} conversion={perk.conversion} />
      {editing ? <EditPerkForm perkId={perk.id} title={perk.title} terms={perk.terms} totalQuantity={perk.totalQuantity} endsAt={perk.endsOn} /> : null}
      <StatusButtons options={["live", "paused", "ended"]} current={perk.status} busy={step.busy} onPick={(status) => void step.run(() => setPerkStatusAction(perk.id, status))} />
      <ErrorLine message={step.error} />
      <button type="button" onClick={() => setEditing((was) => !was)} className={small}>
        {editing ? "Close editor" : "Edit perk"}
      </button>
    </li>
  );
}

/** One shop, collapsed to a line: name, status and its totals. Open it for the PIN, report link and perks. */
export function PartnerCard({ partner }: { partner: PartnerCardData }) {
  const status = useAction();
  const pin = useAction();
  const link = useAction();
  const [editing, setEditing] = useState(false);
  const [confirmLink, setConfirmLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const claimed = partner.perks.reduce((sum, p) => sum + p.claimed, 0);
  const redeemed = partner.perks.reduce((sum, p) => sum + p.redeemed, 0);

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
    <details className="group rounded-2xl border border-zinc-200 dark:border-zinc-800" open={partner.perks.length === 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-base font-semibold">{partner.name}</h2>
          <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
            {perkKindLabel(partner.kind)} · {partner.area}
          </p>
          <p className="text-xs text-zinc-500">
            {partner.perks.length} {partner.perks.length === 1 ? "perk" : "perks"} · {claimed} claimed · {redeemed} redeemed
          </p>
        </div>
        <Pill status={partner.status} />
      </summary>

      <div className="flex flex-col gap-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-500">Shop PIN</span>
            <span className="font-mono text-2xl font-bold tracking-widest">{partner.pin ?? "none"}</span>
          </div>
          <button type="button" disabled={pin.busy} onClick={() => void pin.run(() => newPartnerPinAction(partner.id))} className={small}>
            {pin.busy ? "Making…" : "New PIN"}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-zinc-500">Report link. Private: send it to the shop.</span>
          {partner.reportPath ? <code className="break-all rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-900">{partner.reportPath}</code> : null}
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

        <div className="flex flex-col gap-2">
          <span className="text-xs text-zinc-500">Shop status</span>
          <StatusButtons options={["active", "paused", "ended"]} current={partner.status} busy={status.busy} onPick={(next) => void status.run(() => setPartnerStatusAction(partner.id, next))} />
        </div>
        <ErrorLine message={status.error ?? pin.error} />

        <p className="text-xs text-zinc-500">Open to: {partner.schools}</p>
        {editing ? <EditPartnerForm partnerId={partner.id} name={partner.name} area={partner.area} /> : null}
        <button type="button" onClick={() => setEditing((was) => !was)} className={small}>
          {editing ? "Close editor" : "Edit name and place"}
        </button>

        <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Perks</h3>
          {partner.perks.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {partner.perks.map((perk) => (
                <PerkRow key={perk.id} perk={perk} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No perks yet. Students see nothing until you add one.</p>
          )}
          <AddPerkForm partnerId={partner.id} first={partner.perks.length === 0} />
        </div>
      </div>
    </details>
  );
}

