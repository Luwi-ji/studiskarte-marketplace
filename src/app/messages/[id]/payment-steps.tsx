"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  answerCashAction,
  askToPayAction,
  confirmPaymentAction,
  giveCashAction,
  markPaidAction,
  receiveCashAction,
  rejectCashAction,
  rejectPaymentAction,
  reportDealAction,
  requestCashAction,
} from "@/app/deals/actions";
import { DETAILS_MAX, REPORT_REASONS, type ReportReason } from "@/lib/deals/slot";
import { PAYMENT_LABEL, type PaymentMode } from "@/lib/payment";
import { formatPrice } from "@/lib/posts/format";
import type { DealCardData } from "./handover-panel";
import { NO_ANSWER, ReloadButton } from "./reload-hint";

const button = "h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700";
const primary = "h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60";
const field = "h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700";

/** Runs a step, then keeps the button busy until the refreshed page arrives, so it never shows the old state. */
function useStep() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const refreshing = useRef(false);
  // The buttons are free again once the refreshed page has arrived.
  useEffect(() => {
    if (!pending && refreshing.current) {
      refreshing.current = false;
      setBusy(null);
    }
  }, [pending]);
  async function run(kind: string, action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setBusy(kind);
    setError(null);
    try {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Could not do that.");
        setBusy(null);
        return;
      }
      onOk?.();
      refreshing.current = true;
      startTransition(() => router.refresh());
    } catch {
      setError(NO_ANSWER);
      setBusy(null);
    }
  }
  return { busy, error, run };
}

/** Whose end a report says it was, in words for the viewer. */
function blameText(r: { mine: boolean; blames: "me" | "them" | null }, otherName: string): string {
  if (r.blames === null) return "not sure whose end";
  if (r.mine) return r.blames === "me" ? "your own end" : `${otherName}'s end`;
  return r.blames === "me" ? "your end" : "their own end";
}

type Props = { deal: DealCardData; viewerIsOwner: boolean; otherName: string };

/** How a way of paying reads in a list of choices: cash is always in person, at the handover. */
const wayName = (m: PaymentMode) => (m === "cash" ? "Cash in person" : PAYMENT_LABEL[m]);

const muted = "text-sm text-zinc-600 dark:text-zinc-400";

/**
 * Settling the payment, once a time and place are agreed: payments only exist
 * for a scheduled reservation, so nothing shows before that. Either person can
 * start it, and each sees what they do next and what the other is waiting on:
 * - The one being paid asks to be paid (online, others or cash in person); the
 *   one paying pays without being asked, or offers cash in person.
 * - Online or others: the payer says they paid, the payee confirms (or says not received).
 * - Cash: one asks for cash in person and the other agrees; at the handover, when
 *   the cash really changes hands, the payer says they gave it and the payee
 *   confirms they received it.
 * From "paid" or "cash agreed" on, neither person can cancel.
 */
export function PaymentSteps({ deal, otherName }: Props) {
  const payment = deal.payment;
  const step = useStep();
  const [ask, setAsk] = useState<PaymentMode | "">("");
  const [payWay, setPayWay] = useState<PaymentMode | "">("");
  if (!payment || deal.status !== "scheduled") return null;
  const ways = payment.modes.filter((m): m is "online" | "other" => m !== "cash");
  const cashTaken = payment.modes.includes("cash");
  const askLabel = payment.askMethod ? PAYMENT_LABEL[payment.askMethod].toLowerCase() : "";
  const paidLabel = payment.method ? PAYMENT_LABEL[payment.method].toLowerCase() : "";
  const who = otherName;
  const total = formatPrice("amount", payment.total);
  const busy = step.busy !== null;

  const header = (
    <div>
      <p className="text-sm font-medium">
        Payment: {total} · {payment.modes.map((m) => PAYMENT_LABEL[m]).join(", ")}
      </p>
      {payment.note ? <p className={muted}>{payment.note}</p> : null}
    </div>
  );

  // Until the payer says they paid or cash is agreed, say plainly what that step locks, for whom, and how to meet.
  const lockRule =
    payment.stage === "open" || payment.stage === "asked" || payment.stage === "cash_requested" ? (
      <p className="text-sm">
        {payment.viewerPays
          ? "Meet in a public place and check the item first. Once you say you paid, or cash in person is agreed, neither of you can cancel this reservation."
          : `Meet in a public place. Once ${who} says they paid, or cash in person is agreed, neither of you can cancel this reservation.`}
      </p>
    ) : null;

  /** A pair of buttons: the no first, the yes (the main one) second. */
  const pair = (no: { kind: string; label: string; busyLabel: string; run: () => Promise<{ ok: boolean; error?: string }> }, yes: typeof no) => (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={button} disabled={busy} onClick={() => step.run(no.kind, no.run)}>
        {step.busy === no.kind ? no.busyLabel : no.label}
      </button>
      <button type="button" className={primary} disabled={busy} onClick={() => step.run(yes.kind, yes.run)}>
        {step.busy === yes.kind ? yes.busyLabel : yes.label}
      </button>
    </div>
  );

  const cashAgreedNote = <p className="text-sm font-medium text-green-600">Cash in person agreed. Neither of you can cancel now.</p>;

  let body: React.ReactNode;
  if (payment.stage === "confirmed") {
    body = <p className="text-sm font-medium text-green-600">Payment confirmed{paidLabel ? ` (${paidLabel})` : ""}.</p>;
  } else if (payment.stage === "cash_received") {
    body = <p className="text-sm font-medium text-green-600">Cash received and confirmed. The payment is settled.</p>;
  } else if (payment.stage === "cash_given") {
    body = payment.viewerPays ? (
      <p className="text-sm">You said you gave the cash. Waiting for {who} to confirm they received it.</p>
    ) : (
      <>
        <p className="text-sm">{who} says they gave you the cash. Confirm only if you really have it.</p>
        {pair(
          { kind: "cash-reject", label: "Not received", busyLabel: "Saving…", run: () => rejectCashAction(deal.id) },
          { kind: "cash-receive", label: "I received the cash", busyLabel: "Confirming…", run: () => receiveCashAction(deal.id) },
        )}
      </>
    );
  } else if (payment.stage === "cash_agreed") {
    body = payment.viewerPays ? (
      <>
        {cashAgreedNote}
        <p className="text-sm">When you hand over the cash at the handover, tap the button. {who} then confirms they received it.</p>
        <button type="button" className={primary} disabled={busy} onClick={() => step.run("cash-give", () => giveCashAction(deal.id))}>
          {step.busy === "cash-give" ? "Saving…" : "I gave the cash"}
        </button>
      </>
    ) : (
      <>
        {cashAgreedNote}
        <p className="text-sm">Waiting for {who} to hand you the cash at the handover and say so here. Then you confirm you received it.</p>
      </>
    );
  } else if (payment.stage === "paid") {
    body = payment.viewerPays ? (
      <p className="text-sm">
        You said you paid{paidLabel ? ` by ${paidLabel}` : ""}. Neither of you can cancel now. Waiting for {who} to confirm they received your payment.
      </p>
    ) : (
      <>
        <p className="text-sm">
          {who} says they paid{paidLabel ? ` by ${paidLabel}` : ""}. Confirm when you have it.
        </p>
        <p className="text-sm font-medium">Check your GCash or bank transactions, not a screenshot.</p>
        {pair(
          { kind: "reject", label: "Not received", busyLabel: "Saving…", run: () => rejectPaymentAction(deal.id) },
          { kind: "receive", label: "Confirm received", busyLabel: "Confirming…", run: () => confirmPaymentAction(deal.id) },
        )}
      </>
    );
  } else if (payment.stage === "cash_requested" && payment.cashAskedBy === "payer") {
    // The payer offered cash: the payee answers.
    body = payment.viewerPays ? (
      <p className="text-sm">You offered to pay cash in person at the handover. Waiting for {who} to agree.</p>
    ) : (
      <>
        <p className="text-sm">{who} offers to pay cash in person at the handover.</p>
        {pair(
          { kind: "cash-no", label: "Decline", busyLabel: "Saving…", run: () => answerCashAction(deal.id, false) },
          { kind: "cash-yes", label: "Agree", busyLabel: "Agreeing…", run: () => answerCashAction(deal.id, true) },
        )}
      </>
    );
  } else if (payment.viewerPays) {
    // The payer, before anything is paid or agreed: open, asked, or the payee asked for cash.
    const asked = payment.stage === "asked" ? payment.askMethod : null;
    const way: PaymentMode | "" = ways.length === 1 ? ways[0] : payWay || (ways.find((m) => m === asked) ?? "");
    const askedForCash = payment.stage === "cash_requested";
    body = (
      <>
        {askedForCash ? (
          <p className="text-sm">{who} asks you to pay cash in person at the handover.</p>
        ) : payment.stage === "asked" ? (
          <p className="text-sm">
            {who} asks you to pay{askLabel ? ` by ${askLabel}` : ""}.
          </p>
        ) : (
          <p className={muted}>
            {ways.length > 0 ? `Pay ${who} now, ${cashTaken ? "offer to pay cash in person, " : ""}or wait for them to ask you to pay.` : `This post takes cash only. Offer to pay cash in person, or wait for ${who} to ask you.`}
          </p>
        )}
        {askedForCash
          ? pair(
              { kind: "cash-no", label: "Decline", busyLabel: "Saving…", run: () => answerCashAction(deal.id, false) },
              { kind: "cash-yes", label: "Agree", busyLabel: "Agreeing…", run: () => answerCashAction(deal.id, true) },
            )
          : null}
        {!askedForCash && ways.length > 0 ? (
          <>
            <p className={muted}>Pay {who} yourself (Studiskarte does not move money), then tap the button.</p>
            {ways.length > 1 ? (
              <label className="flex flex-col gap-1 text-sm">
                Paid by
                <select value={way} onChange={(event) => setPayWay(ways.find((m) => m === event.target.value) ?? "")} className={field}>
                  <option value="" disabled>
                    Choose
                  </option>
                  {ways.map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_LABEL[m]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className={primary}
              disabled={busy || way === "" || way === "cash"}
              onClick={() => step.run("pay", () => markPaidAction(deal.id, { method: way === "" ? undefined : way }))}
            >
              {step.busy === "pay" ? "Saving…" : "I've paid"}
            </button>
          </>
        ) : null}
        {!askedForCash && cashTaken ? (
          <button type="button" className={ways.length > 0 ? button : primary} disabled={busy} onClick={() => step.run("cash-offer", () => requestCashAction(deal.id))}>
            {step.busy === "cash-offer" ? "Offering…" : "Offer to pay cash in person"}
          </button>
        ) : null}
      </>
    );
  } else {
    // The payee, before anything is paid or agreed: open, asked, or they asked for cash and wait for the answer.
    const modes = payment.modes;
    const choice: PaymentMode | "" = modes.length === 1 ? modes[0] : ask;
    const alreadyAsked = payment.stage === "asked" || payment.stage === "cash_requested";
    body = (
      <>
        {payment.stage === "cash_requested" ? (
          <p className="text-sm">You asked {who} to pay cash in person at the handover. Waiting for them to agree.</p>
        ) : payment.stage === "asked" ? (
          <p className="text-sm">You asked {who} to pay{askLabel ? ` by ${askLabel}` : ""}. Waiting for them to pay.</p>
        ) : (
          <p className={muted}>To secure the slot, ask {who} to pay. {who} can also pay now or offer cash in person without being asked.</p>
        )}
        {modes.length > 1 ? (
          <label className="flex flex-col gap-1 text-sm">
            Ask to pay by
            <select value={choice} onChange={(event) => setAsk(modes.find((m) => m === event.target.value) ?? "")} className={field}>
              <option value="" disabled>
                Choose
              </option>
              {modes.map((m) => (
                <option key={m} value={m}>
                  {wayName(m)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className={alreadyAsked ? button : primary}
          disabled={busy || choice === ""}
          onClick={() => step.run("ask", () => askToPayAction(deal.id, { method: choice === "" ? undefined : choice }))}
        >
          {step.busy === "ask" ? "Asking…" : alreadyAsked ? "Ask again" : "Ask to pay"}
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {header}
      {lockRule}
      {body}
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      {step.error === NO_ANSWER ? <ReloadButton /> : null}
    </div>
  );
}

/**
 * Telling what went wrong with a reservation that cannot be cancelled (or whose
 * time has passed): whose end it was, the reason and what happened. Once
 * reported the reservation is closed; each side can add their own.
 */
export function ReportBox({ deal, otherName }: { deal: DealCardData; otherName: string }) {
  const step = useStep();
  const [open, setOpen] = useState(false);
  const disputed = deal.status === "disputed";

  return (
    <div className="flex flex-col gap-2">
      {disputed ? (
        <div className="rounded-lg bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">Reported. This reservation is closed and the units are back on the post. Nothing was counted as a handover.</p>
          <ul className="mt-1 flex flex-col gap-1">
            {deal.reports.map((r, i) => (
              <li key={i}>
                <span className="font-medium">{r.mine ? "You" : otherName}:</span> {REPORT_REASONS[r.reason]} ·{" "}
                {blameText(r, otherName)}
                {r.details ? <span className="block text-xs">“{r.details}”</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {deal.canReport && !open ? (
        <button type="button" className={button} onClick={() => setOpen(true)}>
          {disputed ? "Add your side" : "Report what happened"}
        </button>
      ) : null}
      {deal.canReport && open ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void step.run("report", () => reportDealAction(deal.id, { fault: data.get("fault"), reason: data.get("reason"), details: data.get("details") }), () => setOpen(false));
          }}
        >
          {disputed ? null : <p className="text-sm">Reporting closes this reservation. The units go back on the post and the other person is told.</p>}
          <label className="flex flex-col gap-1 text-sm">
            Whose end was the problem?
            <select name="fault" required defaultValue="" className={field}>
              <option value="" disabled>
                Choose
              </option>
              <option value="theirs">{otherName}&apos;s end</option>
              <option value="mine">My end</option>
              <option value="unsure">Not sure</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            What happened?
            <select name="reason" required defaultValue="" className={field}>
              <option value="" disabled>
                Choose
              </option>
              {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
                <option key={r} value={r}>
                  {REPORT_REASONS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tell us more (optional)
            <textarea name="details" rows={3} maxLength={DETAILS_MAX} className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={button} disabled={step.busy !== null} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={primary} disabled={step.busy !== null}>
              {step.busy === "report" ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      ) : null}
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      {step.error === NO_ANSWER ? <ReloadButton /> : null}
    </div>
  );
}
