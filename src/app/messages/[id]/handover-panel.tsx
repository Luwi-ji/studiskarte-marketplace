"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerProposalAction, confirmHandoverAction, proposeHandoverAction } from "@/app/deals/actions";
import { METHOD_LABEL, type HandoverMethod } from "@/lib/deals/handover";
import type { DealCard } from "@/lib/messaging/read";
import type { Availability } from "@/lib/posts/schema";

/** A reservation as the page sends it to the browser: times as text. */
export type DealCardData = Omit<DealCard, "handover" | "proposal"> & {
  handover: { method: HandoverMethod; at: string; place: string } | null;
  proposal: { byMe: boolean; method: HandoverMethod; at: string; place: string } | null;
};

const whenFormat = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const when = (at: string) => whenFormat.format(new Date(at));

/** "Tue 10:00–12:00, Fri 14:00–16:00": when the post can be handed over. */
function describeWindows(windows: Availability[]): string {
  return windows
    .map((w) => `${w.kind === "weekly" ? dayNames[w.weekday] : w.date} ${w.startTime}–${w.endTime}`)
    .join(", ");
}

const button = "h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700";
const field = "h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700";

/**
 * Agreeing how, when and where a reservation is handed over, and saying that it
 * was. Either person proposes; the other agrees (it is then scheduled) or
 * declines. From the agreed time on, each confirms; both make it complete.
 */
export function HandoverPanel({ deal, viewerIsOwner, otherName }: { deal: DealCardData; viewerIsOwner: boolean; otherName: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<HandoverMethod | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the viewer just confirmed, shown at once; the refreshed page then says the same.
  const [justConfirmed, setJustConfirmed] = useState<"waiting" | "completed" | null>(null);

  async function run(kind: string, action: () => Promise<{ ok: boolean; error?: string; completed?: boolean }>) {
    setBusy(kind);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Could not do that.");
      else {
        if (kind === "confirm") setJustConfirmed(result.completed ? "completed" : "waiting");
        setEditing(false);
        router.refresh();
      }
    } catch {
      setError("Could not do that. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const options = deal.options;
  const chosen = method ?? options?.methods[0] ?? "meetup";
  const prefill = chosen === "meetup" ? options?.meetupPlace : options?.deliveryPlace;
  const them = viewerIsOwner ? otherName : "the owner";

  if (deal.status === "completed" || justConfirmed === "completed") {
    return <p className="mt-2 text-sm font-medium text-green-600">Handed over. Both of you confirmed.</p>;
  }
  if (deal.status !== "agreed" && deal.status !== "scheduled") return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {deal.handover ? (
        <div>
          <p className="text-xs text-zinc-500">Handover agreed</p>
          <p className="font-medium">
            {METHOD_LABEL[deal.handover.method]} · {when(deal.handover.at)}
          </p>
          <p className="text-sm">{deal.handover.place}</p>
        </div>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No time and place yet. If none is agreed within 7 days, the reservation is cancelled.</p>
      )}

      {deal.proposal ? (
        <div className="rounded-lg bg-zinc-100 p-2 dark:bg-zinc-800">
          <p className="text-xs text-zinc-500">{deal.proposal.byMe ? "You proposed" : `${viewerIsOwner ? otherName : "The owner"} proposed`}</p>
          <p className="font-medium">
            {METHOD_LABEL[deal.proposal.method]} · {when(deal.proposal.at)}
          </p>
          <p className="text-sm">{deal.proposal.place}</p>
          {deal.proposal.byMe ? (
            <p className="mt-1 text-xs text-zinc-500">Waiting for {them}. You can propose another instead.</p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className={button} disabled={busy !== null} onClick={() => run("decline", () => answerProposalAction(deal.id, false))}>
                {busy === "decline" ? "Declining…" : "Not this time"}
              </button>
              <button type="button" className="h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60" disabled={busy !== null} onClick={() => run("agree", () => answerProposalAction(deal.id, true))}>
                {busy === "agree" ? "Agreeing…" : "Agree"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {deal.status === "scheduled" ? (
        deal.confirmedByMe || justConfirmed === "waiting" ? (
          <p className="text-sm">You confirmed. Waiting for {viewerIsOwner ? otherName : "the owner"} to confirm.</p>
        ) : (
          <>
            {deal.confirmedByOther ? <p className="text-sm">{viewerIsOwner ? otherName : "The owner"} says it was handed over. Confirm if it was.</p> : null}
            <button type="button" className={button} disabled={busy !== null} onClick={() => run("confirm", () => confirmHandoverAction(deal.id))}>
              {busy === "confirm" ? "Confirming…" : viewerIsOwner ? "I handed it over" : "I received it"}
            </button>
          </>
        )
      ) : null}

      {options && !editing ? (
        <button type="button" className={button} disabled={busy !== null} onClick={() => setEditing(true)}>
          {deal.handover ? "Change time or place" : deal.proposal && !deal.proposal.byMe ? "Suggest another" : "Propose a time and place"}
        </button>
      ) : null}

      {options && editing ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void run("propose", () =>
              proposeHandoverAction(deal.id, { method: chosen, date: data.get("date"), time: data.get("time"), place: data.get("place") }),
            );
          }}
        >
          {options.methods.length > 1 ? (
            <fieldset className="flex gap-2">
              <legend className="mb-1 text-sm">How</legend>
              {options.methods.map((m) => (
                <label key={m} className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-zinc-300 px-3 dark:border-zinc-700">
                  <input type="radio" name="method" value={m} checked={chosen === m} onChange={() => setMethod(m)} className="h-5 w-5" />
                  {METHOD_LABEL[m]}
                </label>
              ))}
            </fieldset>
          ) : null}
          <p className="text-xs text-zinc-500">Available: {describeWindows(options.windows)} (Philippine time)</p>
          <label className="flex flex-col gap-1 text-sm">
            Date
            <input name="date" type="date" required className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Time
            <input name="time" type="time" required className={field} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {chosen === "meetup" ? "Where to meet" : "Where to deliver"}
            {/* Keyed on the method, so choosing the other one fills in its place. */}
            <input key={chosen} name="place" type="text" required maxLength={200} defaultValue={prefill ?? ""} className={field} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={button} disabled={busy !== null} onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60" disabled={busy !== null}>
              {busy === "propose" ? "Sending…" : "Send proposal"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
