"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { useAction } from "@/app/safety/use-action";
import { claimPerkAction, redeemVoucherAction } from "./actions";

type OpenVoucher = { id: string; code: string; expiresAt: string };

const when = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** mm:ss since `from`, ticking: a screenshot of the redeemed screen shows an old time. */
function Since({ from }: { from: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

/** The card's button (Claim, Show voucher, or a disabled reason) and the voucher sheet it opens. */
export function VoucherSheet({
  perk,
  studentName,
  handle,
  open: existing,
  label,
  disabledReason,
}: {
  perk: { id: string; title: string; partnerName: string };
  studentName: string;
  handle: string;
  open: OpenVoucher | null;
  label: string;
  disabledReason: string | null;
}) {
  const claim = useAction();
  const redeem = useAction();
  const [sheet, setSheet] = useState(false);
  const [voucher, setVoucher] = useState<OpenVoucher | null>(existing);
  const [pin, setPin] = useState("");
  const [redeemedAt, setRedeemedAt] = useState<string | null>(null);

  function start() {
    if (voucher || existing) {
      setVoucher((current) => current ?? existing);
      setSheet(true);
      return;
    }
    let made: OpenVoucher | null = null;
    void claim.run(
      async () => {
        const result = await claimPerkAction(perk.id);
        if (result.ok) made = result.voucher;
        return result;
      },
      () => {
        setVoucher(made);
        setSheet(true);
      },
      false,
    );
  }

  function confirm() {
    if (!voucher) return;
    let at: string | null = null;
    void redeem.run(
      async () => {
        const result = await redeemVoucherAction(voucher.id, pin);
        if (result.ok) at = result.redeemedAt;
        return result;
      },
      () => {
        setRedeemedAt(at);
        setPin("");
      },
      false,
    );
  }

  return (
    <>
      {/* Once redeemed the page refreshes and the limit may be used up; the sheet stays mounted so the person still sees "Redeemed". */}
      {disabledReason ? (
        <button type="button" disabled className="h-11 w-full rounded-full border border-zinc-300 text-sm font-semibold text-zinc-500 dark:border-zinc-700">
          {disabledReason}
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={start} disabled={claim.busy} className="press h-11 w-full rounded-full bg-brand text-sm font-semibold text-white disabled:opacity-60">
            {claim.busy ? "Claiming…" : label}
          </button>
          {claim.error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {claim.error}
            </p>
          ) : null}
        </div>
      )}
      <BottomSheet open={sheet} onOpenChange={setSheet} label={`Voucher for ${perk.title}`}>
        <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm text-zinc-500">{perk.partnerName}</p>
            <h2 className="text-xl font-bold tracking-tight">{perk.title}</h2>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex min-w-0 flex-col">
              <p className="truncate font-semibold">{studentName}</p>
              <p className="truncate text-sm text-zinc-500">@{handle}</p>
            </div>
            <p className="font-mono text-2xl font-bold tracking-wider">{voucher?.code}</p>
          </div>

          {redeemedAt ? (
            <div role="status" className="flex flex-col gap-1 rounded-2xl bg-emerald-50 p-4 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
              <p className="text-lg font-bold">Redeemed. Enjoy!</p>
              <p className="text-sm">
                Redeemed <Since from={redeemedAt} /> ago
              </p>
            </div>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              {voucher ? <p className="text-sm text-zinc-600 dark:text-zinc-400">Valid until {when.format(new Date(voucher.expiresAt))}</p> : null}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">For the cashier: enter the shop PIN</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  aria-label="Cashier PIN"
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                  className="h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-4 text-center text-xl tracking-[0.5em] dark:border-zinc-700"
                />
              </label>
              {redeem.error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {redeem.error}
                </p>
              ) : null}
              <button type="submit" disabled={redeem.busy || pin.length !== 4} className="press h-12 rounded-full bg-brand text-base font-semibold text-white disabled:opacity-60">
                {redeem.busy ? "Checking…" : "Confirm"}
              </button>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Claim before you arrive. Redeeming needs internet.</p>
            </form>
          )}

          <button
            type="button"
            onClick={() => setSheet(false)}
            className="press flex h-11 items-center justify-center text-base font-medium text-zinc-600 dark:text-zinc-400"
          >
            {redeemedAt ? "Done" : "Close"}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
