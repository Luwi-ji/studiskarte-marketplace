"use client";

import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { reportPostAction, reportStudentAction } from "@/app/safety/actions";
import { CHILD_SAFETY_ID, ReportSent, type ReportTarget } from "@/app/safety/report-button";
import { useAction } from "@/app/safety/use-action";

const DETAILS_MAX = 500;
const MENU_BUTTON = "listing-menu-button";

type Reason = { id: string; label: string };
type Step = { name: "options" } | { name: "reasons"; who: "listing" | "seller" } | { name: "details"; who: "listing" | "seller"; reason: Reason } | { name: "sent"; who: "listing" | "seller"; childSafety: boolean };

/** Stroke paths (24 px grid) for the row icons. */
const ICONS: Record<string, string> = {
  child_safety: "M12 3l8 3v6c0 4.5-3.3 8-8 9-4.7-1-8-4.5-8-9V6l8-3zM12 8v5M12 16h.01",
  spam: "M4 5h16v11H8l-4 4V5z",
  scam: "M12 3l10 18H2L12 3zM12 10v5M12 18h.01",
  prohibited: "M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8",
  offensive: "M12 3a9 9 0 100 18 9 9 0 000-18zM8 15c1-1.5 2.5-2 4-2s3 .5 4 2M9 9.5h.01M15 9.5h.01",
  harassment: "M4 5h16v11H8l-4 4V5zM12 8v3M12 13.5h.01",
  impersonation: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
  other: "M5 12h.01M12 12h.01M19 12h.01",
  flag: "M5 21V4M5 4h12l-2 4 2 4H5",
  person: "M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c0-4 3.6-7 8-7s8 3 8 7",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS.other} />
    </svg>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-zinc-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function Row({ icon, onClick, children }: { icon: string; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-zinc-100 dark:active:bg-zinc-800">
        <Icon name={icon} />
        <span className="min-w-0 flex-1">{children}</span>
        <Chevron />
      </button>
    </li>
  );
}

/**
 * The three-dot button on a listing and its sheets: Options (report the listing, report the seller), then the
 * reasons, then an optional note and Send. The report itself is the same one the app always made.
 */
export function ListingMenu({ postId, sellerHandle, sellerName, reasons }: { postId: string; sellerHandle: string | null; sellerName: string; reasons: readonly Reason[] }) {
  const step = useAction();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<Step>({ name: "options" });

  const show = setState;
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setState({ name: "options" });
  }
  const sellerLabel = `Report ${sellerName}`;
  let label = "Options";
  if (state.name === "reasons" || state.name === "details") label = state.who === "listing" ? "Report this listing" : sellerLabel;
  if (state.name === "sent") label = "Report sent";

  function target(who: "listing" | "seller"): ReportTarget | null {
    return who === "listing" ? { kind: "post", postId } : sellerHandle ? { kind: "student", handle: sellerHandle } : null;
  }

  const header = (title: string, back?: () => void) => (
    <div data-sheet-drag className="flex min-h-12 shrink-0 items-center gap-1 px-2">
      {back ? (
        <button type="button" onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      ) : (
        <span className="w-2" />
      )}
      <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h2>
    </div>
  );

  let body: ReactNode;
  if (state.name === "options") {
    body = (
      <>
        {header("Options")}
        <ul className="flex flex-col divide-y divide-zinc-200 pb-[env(safe-area-inset-bottom)] dark:divide-zinc-800">
          <Row icon="flag" onClick={() => show({ name: "reasons", who: "listing" })}>
            Report this listing
          </Row>
          {sellerHandle ? (
            <Row icon="person" onClick={() => show({ name: "reasons", who: "seller" })}>
              Report the seller
            </Row>
          ) : null}
        </ul>
      </>
    );
  } else if (state.name === "reasons") {
    const who = state.who;
    body = (
      <>
        {header(who === "listing" ? "Report this listing" : sellerLabel, () => show({ name: "options" }))}
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <p className="px-4 pb-2 text-sm text-zinc-600 dark:text-zinc-400">{who === "listing" ? "Why are you reporting this listing?" : "Why are you reporting this person?"}</p>
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {reasons.map((r) => (
              <Row key={r.id} icon={r.id} onClick={() => show({ name: "details", who, reason: r })}>
                {r.label}
              </Row>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (state.name === "details") {
    const { who, reason } = state;
    const t = target(who);
    body = (
      <>
        {header(who === "listing" ? "Report this listing" : sellerLabel, () => show({ name: "reasons", who }))}
        <form
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-left"
          onSubmit={(event) => {
            event.preventDefault();
            if (!t) return;
            const details = new FormData(event.currentTarget).get("details");
            const input = { reason: reason.id, details };
            void step.run(
              () => (t.kind === "post" ? reportPostAction(t.postId, input) : reportStudentAction(t.handle, input)),
              () => show({ name: "sent", who, childSafety: reason.id === CHILD_SAFETY_ID }),
              false,
            );
          }}
        >
          <p className="rounded-lg bg-zinc-100 px-3 py-2.5 text-sm dark:bg-zinc-800">{reason.label}</p>
          <label className="flex flex-col gap-1 text-sm">
            Tell us more (optional)
            <textarea name="details" rows={3} maxLength={DETAILS_MAX} className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" />
          </label>
          {step.error ? (
            <p role="alert" className="text-sm text-red-600">
              {step.error}
            </p>
          ) : null}
          <button type="submit" className="h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60" disabled={step.busy}>
            {step.busy ? "Sending…" : "Send report"}
          </button>
        </form>
      </>
    );
  } else {
    const t = target(state.who);
    body = (
      <>
        {header("Report sent")}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {t ? <ReportSent target={t} childSafety={state.childSafety} /> : null}
          <button type="button" onClick={() => onOpenChange(false)} className="mt-3 h-11 w-full rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
            Done
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="More options"
        aria-haspopup="dialog"
        className={`${MENU_BUTTON} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm active:bg-black/60`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      <BottomSheet open={open} onOpenChange={onOpenChange} label={label} returnFocusTo={`.${MENU_BUTTON}`}>
        {body}
      </BottomSheet>
    </>
  );
}
