"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { reportPostAction, reportStudentAction } from "./actions";
import { BlockButton, BlockConfirm } from "./block-button";
import { useAction } from "./use-action";

const DETAILS_MAX = 500;
const MENU_BUTTON = "menu-sheet-button";
/** The sheet slides out in 220 ms; the steps are put back to Options once it is gone, so nothing flashes while it closes. */
const RESET_AFTER_MS = 300;
/** The reason id that CHILD_SAFETY_REASON names on the server (that module reads the database, so the browser cannot import it). */
const CHILD_SAFETY_ID = "child_safety";

type Reason = { id: string; label: string };
type ReportTarget = { kind: "post"; postId: string } | { kind: "student"; handle: string };

/** One thing that can be reported: its row on the Options step, its title, and the question over the reasons. */
type Report = { target: ReportTarget; row: string; title: string; question: string };

/** An extra row on the Options step that opens a step of its own (the thread's Transactions). */
export type MenuExtra = {
  id: string;
  icon: string;
  label: string;
  /** A muted count or note after the label. */
  detail?: string;
  title: string;
  content: ReactNode;
};

type Step =
  | { name: "options" }
  | { name: "reasons"; report: number }
  | { name: "details"; report: number; reason: Reason }
  | { name: "sent"; report: number; childSafety: boolean }
  | { name: "extra"; id: string }
  | { name: "block" };

const OPTIONS: Step = { name: "options" };

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
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
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

function Row({ icon, detail, danger, onClick, children }: { icon: string; detail?: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button type="button" onClick={onClick} className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-zinc-100 dark:active:bg-zinc-800 ${danger ? "text-red-600 dark:text-red-400" : ""}`}>
        <Icon name={icon} />
        <span className="min-w-0 flex-1">{children}</span>
        {detail ? <span className="shrink-0 text-sm text-zinc-500">{detail}</span> : null}
        <Chevron />
      </button>
    </li>
  );
}

/** The top of a step: a Back arrow (or a Close on the first step) and the title. Dragging it down closes the sheet. */
function Header({ title, back, close }: { title: string; back?: () => void; close?: () => void }) {
  return (
    <div data-sheet-drag className="flex min-h-12 shrink-0 touch-none items-center gap-1 px-2">
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
      {close ? (
        <button type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

const blockStyle = "h-11 w-full rounded-lg border border-red-300 text-sm font-medium text-red-600 dark:border-red-900";

/** What the reporter sees once the report is in: when the owner reads it, the safety line, and a way to block. */
function ReportSent({ target, childSafety }: { target: ReportTarget; childSafety: boolean }) {
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 text-left text-sm dark:border-zinc-700">
      <p>
        <span className="font-semibold">Report sent.</span>{" "}
        {childSafety
          ? "The owner aims to read child safety reports within 24 hours."
          : "The owner aims to read urgent reports within 24 hours and others within 3 working days."}{" "}
        The other student is not told who reported. If you are in danger now, leave the place and call 911.
      </p>
      {target.kind === "student" ? (
        <BlockButton handle={target.handle} label="Block this student" className={blockStyle} />
      ) : (
        <BlockButton postId={target.postId} label="Block the person who posted this" className={blockStyle} />
      )}
    </div>
  );
}

/** The optional note and Send. Its own component, so a failed send, a half-typed note and "Sending…" never outlive this step. */
function DetailsForm({ target, reason, onSent }: { target: ReportTarget; reason: Reason; onSent: () => void }) {
  const step = useAction();
  return (
    <form
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-left"
      onSubmit={(event) => {
        event.preventDefault();
        const input = { reason: reason.id, details: new FormData(event.currentTarget).get("details") };
        void step.run(() => (target.kind === "post" ? reportPostAction(target.postId, input) : reportStudentAction(target.handle, input)), onSent, false);
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
  );
}

/** The three dots: over a photo ("overlay") or in a page's top bar ("plain"). */
type Trigger = "overlay" | "plain";

/**
 * The menu behind a three-dot button, the same on a listing, in a conversation and on a profile. One sheet, in steps:
 * Options, then (for a report) the reasons, an optional note with Send, and "Report sent"; or one of the extra rows
 * (`before`, such as the thread's Transactions) or Block (`blockHandle`). Back goes up one step. However the sheet is
 * closed (X, Escape, a tap outside, a swipe, Done) it opens on Options next time, and a note not sent is dropped.
 * The reports are the ones the app always had: `reportPostAction` and `reportStudentAction`.
 */
export function MenuSheet({
  trigger,
  reasons,
  name,
  handle,
  postId,
  before,
  blockHandle,
}: {
  trigger: Trigger;
  reasons: readonly Reason[];
  /** What to call the other student, in titles. */
  name: string;
  /** The student a report is about; no "Report this student" row without it. */
  handle: string | null;
  /** The listing, on a listing's menu: adds "Report this listing". */
  postId?: string;
  before?: MenuExtra[];
  /** Adds "Block <name>" as the last row, which asks first. */
  blockHandle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(OPTIONS);

  function onOpenChange(next: boolean) {
    if (next) setStep(OPTIONS);
    setOpen(next);
  }
  // Closed for good: put the steps back to Options once the sheet has slid out.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => setStep(OPTIONS), RESET_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const reports: Report[] = [];
  if (postId) reports.push({ target: { kind: "post", postId }, row: "Report this listing", title: "Report this listing", question: "Why are you reporting this listing?" });
  if (handle) reports.push({ target: { kind: "student", handle }, row: "Report this student", title: `Report ${name}`, question: "Why are you reporting this person?" });

  const close = () => onOpenChange(false);
  const toOptions = () => setStep(OPTIONS);

  let title = "Options";
  let body: ReactNode;
  if (step.name === "reasons") {
    const report = reports[step.report];
    title = report.title;
    body = (
      <>
        <Header title={title} back={toOptions} />
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <p className="px-4 pb-2 text-sm text-zinc-600 dark:text-zinc-400">{report.question}</p>
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {reasons.map((r) => (
              <Row key={r.id} icon={r.id} onClick={() => setStep({ name: "details", report: step.report, reason: r })}>
                {r.label}
              </Row>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (step.name === "details") {
    const report = reports[step.report];
    title = report.title;
    const index = step.report;
    body = (
      <>
        <Header title={title} back={() => setStep({ name: "reasons", report: index })} />
        <DetailsForm target={report.target} reason={step.reason} onSent={() => setStep({ name: "sent", report: index, childSafety: step.reason.id === CHILD_SAFETY_ID })} />
      </>
    );
  } else if (step.name === "sent") {
    title = "Report sent";
    body = (
      <>
        <Header title={title} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <ReportSent target={reports[step.report].target} childSafety={step.childSafety} />
          <button type="button" onClick={close} className="mt-3 h-11 w-full rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
            Done
          </button>
        </div>
      </>
    );
  } else if (step.name === "block" && blockHandle) {
    title = `Block ${name}?`;
    body = (
      <>
        <Header title={title} back={toOptions} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BlockConfirm handle={blockHandle} onCancel={toOptions} onDone={close} />
        </div>
      </>
    );
  } else if (step.name === "extra" && before?.some((e) => e.id === step.id)) {
    const extra = before.find((e) => e.id === step.id)!;
    title = extra.title;
    body = (
      <>
        <Header title={title} back={toOptions} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{extra.content}</div>
      </>
    );
  } else {
    body = (
      <>
        <Header title="Options" close={close} />
        <ul className="flex flex-col divide-y divide-zinc-200 pb-[env(safe-area-inset-bottom)] dark:divide-zinc-800">
          {before?.map((e) => (
            <Row key={e.id} icon={e.icon} detail={e.detail} onClick={() => setStep({ name: "extra", id: e.id })}>
              {e.label}
            </Row>
          ))}
          {reports.map((r, index) => (
            <Row key={r.row} icon={r.target.kind === "post" ? "flag" : "person"} onClick={() => setStep({ name: "reasons", report: index })}>
              {r.row}
            </Row>
          ))}
          {blockHandle ? (
            <Row icon="prohibited" danger onClick={() => setStep({ name: "block" })}>
              Block {name}
            </Row>
          ) : null}
        </ul>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="More options"
        aria-haspopup="dialog"
        className={`${MENU_BUTTON} flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${trigger === "overlay" ? "bg-black/50 text-white backdrop-blur-sm active:bg-black/60" : "active:bg-zinc-100 dark:active:bg-zinc-800"}`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      <BottomSheet open={open} onOpenChange={onOpenChange} label={title} returnFocusTo={`.${MENU_BUTTON}`} portal>
        {body}
      </BottomSheet>
    </>
  );
}
