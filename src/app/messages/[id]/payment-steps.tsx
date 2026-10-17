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

/**
 * Securing the slot and settling the payment, once a time and place are
 * agreed. Online or others: the one being paid asks, the payer says they paid,
 * the payee confirms. Cash: the payer asks to pay cash in person and the payee
 * agrees (the slot is then secured); at the handover, when the cash really
 * changes hands, the payer says they gave it and the payee confirms they
 * received it. From "paid" or "cash agreed" on the slot cannot be cancelled.
 */
export function PaymentSteps({ deal, otherName }: Props) {
  const payment = deal.payment;
  const step = useStep();
  const [ask, setAsk] = useState<PaymentMode | "">("");
  if (!payment) return null;
  const waysOnline = payment.modes.filter((m) => m !== "cash");
  const cashTaken = payment.modes.includes("cash");
  const askLabel = payment.askMethod ? PAYMENT_LABEL[payment.askMethod].toLowerCase() : "";
  const paidLabel = payment.method ? PAYMENT_LABEL[payment.method].toLowerCase() : "";
  const who = otherName;
  const total = formatPrice("amount", payment.total);

  const header = (
    <div>
      <p className="text-xs text-zinc-500">Payment · {total} in all</p>
      <p className="text-sm">Takes: {payment.modes.map((m) => PAYMENT_LABEL[m]).join(", ")}</p>
      {payment.note ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{payment.note}</p> : null}
    </div>
  );

  let body: React.ReactNode;
  if (deal.status === "agreed") {
    body = <p className="text-sm text-zinc-600 dark:text-zinc-400">Agree a time and place first. Then the slot is secured by payment.</p>;
  } else if (payment.stage === "confirmed") {
    body = <p className="text-sm font-medium text-green-600">Payment confirmed{paidLabel ? ` (${paidLabel})` : ""}. The slot is secured.</p>;
  } else if (payment.stage === "cash_received") {
    body = <p className="text-sm font-medium text-green-600">Cash received and confirmed. The payment is settled.</p>;
  } else if (payment.stage === "cash_given") {
    body = payment.viewerPays ? (
      <p className="text-sm">You said you gave the cash. Waiting for {who} to confirm they received it.</p>
    ) : (
      <>
        <p className="text-sm">{who} says they gave you the cash. Confirm only if you really have it.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={button} disabled={step.busy !== null} onClick={() => step.run("cash-reject", () => rejectCashAction(deal.id))}>
            {step.busy === "cash-reject" ? "Saving…" : "Not received"}
          </button>
          <button type="button" className={primary} disabled={step.busy !== null} onClick={() => step.run("cash-receive", () => receiveCashAction(deal.id))}>
            {step.busy === "cash-receive" ? "Confirming…" : "I received the cash"}
          </button>
        </div>
      </>
    );
  } else if (payment.stage === "cash_agreed") {
    body = payment.viewerPays ? (
      <>
        <p className="text-sm font-medium text-green-600">Cash in person agreed. The slot is secured.</p>
        <p className="text-sm">When you hand over the cash at the handover, tap the button. {who} then confirms they received it.</p>
        <button type="button" className={primary} disabled={step.busy !== null} onClick={() => step.run("cash-give", () => giveCashAction(deal.id))}>
          {step.busy === "cash-give" ? "Saving…" : "I gave the cash"}
        </button>
      </>
    ) : (
      <>
        <p className="text-sm font-medium text-green-600">Cash in person agreed. The slot is secured.</p>
        <p className="text-sm">{who} hands you the cash at the handover and says so in the app. Then you confirm you received it.</p>
      </>
    );
  } else if (payment.stage === "paid") {
    body = payment.viewerPays ? (
      <p className="text-sm">
        You said you paid{paidLabel ? ` by ${paidLabel}` : ""}. The slot is secured. Waiting for {who} to confirm.
      </p>
    ) : (
      <>
        <p className="text-sm">
          {who} says they paid{paidLabel ? ` by ${paidLabel}` : ""}. Confirm when you have it.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={button} disabled={step.busy !== null} onClick={() => step.run("reject", () => rejectPaymentAction(deal.id))}>
            {step.busy === "reject" ? "Saving…" : "Not received"}
          </button>
          <button type="button" className={primary} disabled={step.busy !== null} onClick={() => step.run("receive", () => confirmPaymentAction(deal.id))}>
            {step.busy === "receive" ? "Confirming…" : "Payment received"}
          </button>
        </div>
      </>
    );
  } else if (payment.stage === "cash_requested") {
    body = payment.viewerPays ? (
      <p className="text-sm">You asked to pay cash in person at the handover. Waiting for {who} to agree.</p>
    ) : (
      <>
        <p className="text-sm">{who} asks to pay cash in person at the handover. If you agree, the slot is secured and neither of you can cancel.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={button} disabled={step.busy !== null} onClick={() => step.run("cash-no", () => answerCashAction(deal.id, false))}>
            {step.busy === "cash-no" ? "Saving…" : "Not this time"}
          </button>
          <button type="button" className={primary} disabled={step.busy !== null} onClick={() => step.run("cash-yes", () => answerCashAction(deal.id, true))}>
            {step.busy === "cash-yes" ? "Agreeing…" : "Agree"}
          </button>
        </div>
      </>
    );
  } else if (payment.viewerPays) {
    // open or asked
    body = (
      <>
        {payment.stage === "asked" ? (
          <p className="text-sm">
            {who} asks you to pay{askLabel ? ` by ${askLabel}` : ""}. Paying secures the slot: after that it can&apos;t be cancelled.
          </p>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Waiting for {who} to ask you to pay{cashTaken ? ", or you can ask to pay cash in person" : ""}.
          </p>
        )}
        {payment.stage === "asked" ? (
          <button type="button" className={primary} disabled={step.busy !== null} onClick={() => step.run("pay", () => markPaidAction(deal.id))}>
            {step.busy === "pay" ? "Saving…" : "I've paid"}
          </button>
        ) : null}
        {cashTaken ? (
          <button type="button" className={button} disabled={step.busy !== null} onClick={() => step.run("cash-ask", () => requestCashAction(deal.id))}>
            {step.busy === "cash-ask" ? "Asking…" : payment.stage === "asked" ? "Pay cash in person instead" : "Ask to pay cash in person"}
          </button>
        ) : null}
      </>
    );
  } else {
    // the payee, open or asked
    body =
      waysOnline.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Only cash is taken. Waiting for {who} to ask to pay cash in person.</p>
      ) : (
        <>
          {payment.stage === "asked" ? (
            <p className="text-sm">You asked {who} to pay{askLabel ? ` by ${askLabel}` : ""}. Waiting for them.</p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">To secure the slot, ask {who} to pay{cashTaken ? ", or wait for them to ask to pay cash in person" : ""}.</p>
          )}
          {payment.stage === "open" || waysOnline.length > 1 ? (
            <>
              {waysOnline.length > 1 ? (
                <label className="flex flex-col gap-1 text-sm">
                  Pay by
                  <select value={ask} onChange={(event) => setAsk(waysOnline.find((m) => m === event.target.value) ?? "")} className={field}>
                    <option value="" disabled>
                      Choose
                    </option>
                    {waysOnline.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_LABEL[m]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                type="button"
                className={button}
                disabled={step.busy !== null || (waysOnline.length > 1 && ask === "")}
                onClick={() => step.run("ask", () => askToPayAction(deal.id, { method: ask === "" ? undefined : ask }))}
              >
                {step.busy === "ask" ? "Asking…" : payment.stage === "asked" ? "Ask again" : `Ask ${who} to pay`}
              </button>
            </>
          ) : null}
        </>
      );
  }

  return (
    <div className="flex flex-col gap-2">
      {header}
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
