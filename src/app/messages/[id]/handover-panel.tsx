"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { answerProposalAction, confirmHandoverAction, proposeHandoverAction, rejectHandoverAction } from "@/app/deals/actions";
import { chooseableDays, METHOD_LABEL, suggestTime, time12, to24h, windowsOn, type HandoverMethod } from "@/lib/deals/handover";
import type { DealCard } from "@/lib/messaging/read";
import type { Availability } from "@/lib/posts/schema";
import { isSettled } from "@/lib/deals/slot";
import { CalendarActions } from "./calendar-actions";
import { PaymentSteps, ReportBox } from "./payment-steps";
import { NO_ANSWER, ReloadButton } from "./reload-hint";
import { ReviewBox } from "./review-box";

/** A reservation as the page sends it to the browser: times as text. */
export type DealCardData = Omit<DealCard, "handover" | "proposal" | "activityAt"> & {
  /** When the last thing happened on it, as an ISO time. */
  activityAt: string;
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

/** What a reservation with both handover confirmations still waits for, from the viewer's side. */
function waitingFor(payment: NonNullable<DealCardData["payment"]>): string {
  if (payment.stage === "cash_agreed") {
    return payment.viewerPays ? "Waiting for the cash: tap \"I gave the cash\" above when you hand it over." : "Waiting for the cash: they say when they gave it, then you confirm you received it.";
  }
  if (payment.stage === "cash_given") {
    return payment.viewerPays ? "Waiting for them to confirm they received the cash." : "Confirm above that you received the cash.";
  }
  return "Waiting for the payment to be settled.";
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
  // The time on the form: an hour (1 to 12), minute and AM or PM, as the person sees it.
  const [clock, setClock] = useState({ hour: "9", minute: "0", ampm: "AM" });
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the viewer just confirmed, shown at once until the refreshed page says the same. It only holds while the
  // reservation has had no newer step (`at`): if the other person took the confirmation back, the page wins.
  const [justConfirmed, setJustConfirmed] = useState<{ kind: "waiting" | "completed"; at: string } | null>(null);

  async function run(kind: string, action: () => Promise<{ ok: boolean; error?: string; completed?: boolean }>) {
    setBusy(kind);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error ?? "Could not do that.");
      else {
        if (kind === "confirm") setJustConfirmed({ kind: result.completed ? "completed" : "waiting", at: deal.activityAt });
        setEditing(false);
        setDay("");
        router.refresh();
      }
    } catch {
      setError(NO_ANSWER);
    } finally {
      setBusy(null);
    }
  }

  // A refusal shows up beside the button that was tapped, so bring it into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [error]);

  const options = deal.options;
  const windows = viewerIsOwner ? null : (options?.windows ?? null);
  /** Fills in the time for a day: the start of that day's availability, or the next hour if today's has passed. */
  function suggest(date: string) {
    const [h24, m] = suggestTime(date, windows).split(":").map(Number);
    setClock({ hour: String(h24 % 12 === 0 ? 12 : h24 % 12), minute: String(m), ampm: h24 < 12 ? "AM" : "PM" });
  }
  function openForm() {
    // A failure here must show, not leave a button that does nothing.
    try {
      const first = chooseableDays(windows)[0]?.date ?? "";
      setDay(first);
      if (first) suggest(first);
    } catch (failure) {
      setError(`Could not fill in the form (${failure instanceof Error ? failure.message : "unknown"}). You can still pick the day and time yourself.`);
    }
    setEditing(true);
  }
  const chosen = method ?? options?.methods[0] ?? "meetup";
  const prefill = chosen === "meetup" ? options?.meetupPlace : null;
  const them = viewerIsOwner ? otherName : "the owner";

  if (deal.status === "completed" || justConfirmed?.kind === "completed") {
    return (
      <>
        <p className="mt-2 text-sm font-medium text-green-600">Completed. The handover{deal.payment ? " and the payment are" : " is"} confirmed.</p>
        {deal.review !== null ? <ReviewBox deal={deal} otherName={otherName} /> : null}
      </>
    );
  }
  if (deal.status === "disputed") return <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"><ReportBox deal={deal} otherName={otherName} /></div>;
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
          <CalendarActions deal={deal} />
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

      <PaymentSteps deal={deal} viewerIsOwner={viewerIsOwner} otherName={otherName} />

      {deal.status === "scheduled" ? (
        deal.confirmedByMe || (justConfirmed?.kind === "waiting" && justConfirmed.at === deal.activityAt) ? (
          <p className="text-sm">
            {deal.confirmedByOther && deal.payment && !isSettled(deal.payment.stage)
              ? `Both of you confirmed the handover. ${waitingFor(deal.payment)}`
              : `You confirmed. Waiting for ${viewerIsOwner ? otherName : "the owner"} to confirm.`}
          </p>
        ) : (
          <>
            {deal.confirmedByOther ? <p className="text-sm">{viewerIsOwner ? otherName : "The owner"} says it was {deal.viewerHandsOver ? "received" : "handed over"}. Confirm if it was, or say it was not.</p> : null}
            {deal.confirmedByOther ? (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className={button} disabled={busy !== null} onClick={() => run("reject-handover", () => rejectHandoverAction(deal.id))}>
                  {busy === "reject-handover" ? "Saving…" : deal.viewerHandsOver ? "I didn't hand it over" : "I didn't receive it"}
                </button>
                <button type="button" className="h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60" disabled={busy !== null} onClick={() => run("confirm", () => confirmHandoverAction(deal.id))}>
                  {busy === "confirm" ? "Confirming…" : deal.viewerHandsOver ? "I handed it over" : "I received it"}
                </button>
              </div>
            ) : (
              <button type="button" className={button} disabled={busy !== null} onClick={() => run("confirm", () => confirmHandoverAction(deal.id))}>
                {busy === "confirm" ? "Confirming…" : deal.viewerHandsOver ? "I handed it over" : "I received it"}
              </button>
            )}
          </>
        )
      ) : null}

      {options && !editing ? (
        <button type="button" className={button} disabled={busy !== null} onClick={openForm}>
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
            <select
              name="date"
              required
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                suggest(event.target.value);
              }}
              className={field}
            >
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
              <select name="hour" aria-label="Hour" required value={clock.hour} onChange={(e) => setClock({ ...clock, hour: e.target.value })} className={field}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <select name="minute" aria-label="Minute" required value={clock.minute} onChange={(e) => setClock({ ...clock, minute: e.target.value })} className={field}>
                {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                ))}
              </select>
              <select name="ampm" aria-label="AM or PM" required value={clock.ampm} onChange={(e) => setClock({ ...clock, ampm: e.target.value })} className={field}>
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
          {error ? (
            <p ref={errorRef} role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {error === NO_ANSWER ? <ReloadButton /> : null}
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

      {deal.secured ? <p className="text-xs text-zinc-500">This can&apos;t be cancelled any more. If something goes wrong, report what happened.</p> : null}
      {deal.canReport ? <ReportBox deal={deal} otherName={otherName} /> : null}

      {error && !editing ? (
        <p ref={errorRef} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {error === NO_ANSWER && !editing ? <ReloadButton /> : null}
    </div>
  );
}
