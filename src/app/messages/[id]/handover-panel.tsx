"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { answerProposalAction, confirmHandoverAction, confirmPaymentAction, markPaidAction, proposeHandoverAction } from "@/app/deals/actions";
import { chooseableDays, METHOD_LABEL, time12, to24h, windowsOn, type HandoverMethod } from "@/lib/deals/handover";
import type { DealCard } from "@/lib/messaging/read";
import { PAYMENT_LABEL, type PaymentMode } from "@/lib/payment";
import { formatPrice } from "@/lib/posts/format";
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
    .map((w) => `${w.kind === "weekly" ? dayNames[w.weekday] : w.date} ${time12(w.startTime)}–${time12(w.endTime)}`)
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
  const [day, setDay] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the viewer just confirmed, shown at once; the refreshed page then says the same.
  const [payMethod, setPayMethod] = useState<PaymentMode | null>(null);
  // Payment as we last changed it, until the refreshed page says the same.
  const [paymentNow, setPaymentNow] = useState<"paid" | "confirmed" | null>(null);
  const [justConfirmed, setJustConfirmed] = useState<"waiting" | "completed" | null>(null);

  async function run(kind: string, action: () => Promise<{ ok: boolean; error?: string; completed?: boolean }>) {
    setBusy(kind);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Could not do that.");
      else {
        if (kind === "confirm") setJustConfirmed(result.completed ? "completed" : "waiting");
        if (kind === "pay") setPaymentNow("paid");
        if (kind === "receive") {
          setPaymentNow("confirmed");
          if (result.completed) setJustConfirmed("completed");
        }
        setEditing(false);
        setDay("");
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
  // How it was paid, as known now: from the server, or what was just chosen.
  const paidBy = deal.payment?.method ?? payMethod ?? (deal.payment?.modes.length === 1 ? deal.payment.modes[0] : null);
  const them = viewerIsOwner ? otherName : "the owner";

  if (deal.status === "completed" || justConfirmed === "completed") {
    return <p className="mt-2 text-sm font-medium text-green-600">Completed. The handover{deal.payment ? " and the payment are" : " is"} confirmed.</p>;
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

      {deal.payment ? (
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs text-zinc-500">Payment · {formatPrice("amount", deal.payment.total)} in all</p>
            <p className="text-sm">Pay by: {deal.payment.modes.map((m) => PAYMENT_LABEL[m]).join(", ")}</p>
            {deal.payment.note ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{deal.payment.note}</p> : null}
          </div>
          {deal.payment.confirmed || paymentNow === "confirmed" ? (
            <p className="text-sm font-medium text-green-600">Payment confirmed{paidBy ? ` (${PAYMENT_LABEL[paidBy]})` : ""}.</p>
          ) : deal.payment.paid || paymentNow === "paid" ? (
            deal.payment.viewerPays ? (
              <p className="text-sm">You said you paid{paidBy ? ` by ${PAYMENT_LABEL[paidBy].toLowerCase()}` : ""}. Waiting for them to confirm.</p>
            ) : (
              <>
                <p className="text-sm">{otherName} says they paid{paidBy ? ` by ${PAYMENT_LABEL[paidBy].toLowerCase()}` : ""}. Confirm when you have it.</p>
                <button type="button" className={button} disabled={busy !== null} onClick={() => run("receive", () => confirmPaymentAction(deal.id))}>
                  {busy === "receive" ? "Confirming…" : "Payment received"}
                </button>
              </>
            )
          ) : deal.payment.viewerPays ? (
            <>
              {deal.payment.modes.length > 1 ? (
                <label className="flex flex-col gap-1 text-sm">
                  How did you pay?
                  <select value={payMethod ?? ""} onChange={(event) => setPayMethod(deal.payment?.modes.find((m) => m === event.target.value) ?? null)} className={field}>
                    <option value="" disabled>
                      Choose
                    </option>
                    {deal.payment.modes.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="button" className={button} disabled={busy !== null || (deal.payment.modes.length > 1 && payMethod === null)} onClick={() => run("pay", () => markPaidAction(deal.id, { method: payMethod ?? undefined }))}>
                {busy === "pay" ? "Saving…" : "I've paid"}
              </button>
            </>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Waiting for {otherName} to pay.</p>
          )}
        </div>
      ) : null}

      {deal.status === "scheduled" ? (
        deal.confirmedByMe || justConfirmed === "waiting" ? (
          <p className="text-sm">
            {deal.confirmedByOther && deal.payment && !deal.payment.confirmed
              ? "Both of you confirmed the handover. Waiting for the payment to be confirmed."
              : `You confirmed. Waiting for ${viewerIsOwner ? otherName : "the owner"} to confirm.`}
          </p>
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
              proposeHandoverAction(deal.id, {
                method: chosen,
                date: data.get("date"),
                time: to24h(Number(data.get("hour")), Number(data.get("minute")), data.get("ampm") === "PM"),
                place: data.get("place"),
              }),
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
          <p className="text-xs text-zinc-500">
            {viewerIsOwner ? "It is your post, so you can pick any day and time." : `Available: ${describeWindows(options.windows)} (Philippine time)`}
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Day
            <select name="date" required value={day} onChange={(event) => setDay(event.target.value)} className={field}>
              <option value="" disabled>
                Choose a day
              </option>
              {chooseableDays(viewerIsOwner ? null : options.windows).map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Time</legend>
            <div className="grid grid-cols-3 gap-2">
              <select name="hour" aria-label="Hour" required defaultValue="9" className={field}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <select name="minute" aria-label="Minute" required defaultValue="0" className={field}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <select name="ampm" aria-label="AM or PM" required defaultValue="AM" className={field}>
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
            {day && !viewerIsOwner ? (
              <span className="text-xs text-zinc-500">
                That day: {windowsOn(day, options.windows).map((w) => `${time12(w.startTime)} to ${time12(w.endTime)}`).join(", ")}
              </span>
            ) : null}
          </fieldset>
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
