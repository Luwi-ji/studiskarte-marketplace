"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BlockButton } from "@/app/safety/block-button";
import { useAction } from "@/app/safety/use-action";
import { FloatingField } from "@/components/floating-field";
import { BAD_LISTING_LINK, NO_LISTING_LINK, parsePostLink, parseReportHandle } from "@/lib/safety/report-target";
import { reportListingAction, reportUserAction } from "./actions";

const DETAILS_MAX = 500;

type Reason = { id: string; label: string };
type Kind = "listing" | "user";

/** What was reported, for the confirmation. */
type Sent = { kind: "listing"; postId: string; reason: Reason } | { kind: "user"; handle: string; reason: Reason };

const fieldClass = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const errorClass = "text-sm text-red-600 dark:text-red-400";
const mutedClass = "text-sm text-zinc-600 dark:text-zinc-400";

/**
 * Report a listing (by its pasted link) or a student (by username) from Settings. The same reasons and the same server
 * rules as the Report sheet on a listing or profile. Everything typed stays after an error; after a send a confirmation
 * takes the form's place, with a way to send another.
 */
export function ReportForm({ kind, reasons, childSafetyId }: { kind: Kind; reasons: readonly Reason[]; childSafetyId: string }) {
  const step = useAction();
  const [target, setTarget] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [details, setDetails] = useState("");
  const [targetError, setTargetError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const confirmation = useRef<HTMLDivElement>(null);

  // The form is gone once sent: move the reader to the confirmation.
  useEffect(() => {
    if (sent) confirmation.current?.focus();
  }, [sent]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.busy) return;

    const reason = reasons.find((r) => r.id === reasonId);
    let problem: string | null;
    let done: Sent | null = null;
    if (kind === "listing") {
      const postId = parsePostLink(target);
      problem = postId ? null : target.trim() === "" ? NO_LISTING_LINK : BAD_LISTING_LINK;
      if (postId && reason) done = { kind: "listing", postId, reason };
    } else {
      const parsed = parseReportHandle(target);
      problem = parsed.ok ? null : parsed.message;
      if (parsed.ok && reason) done = { kind: "user", handle: parsed.handle, reason };
    }
    setTargetError(problem);
    setReasonError(reason ? null : "Choose what is wrong.");
    if (!done) return;

    const input = { reason: done.reason.id, details };
    const sentTarget = done;
    void step.run(() => (kind === "listing" ? reportListingAction(target, input) : reportUserAction(target, input)), () => setSent(sentTarget), false);
  }

  function again() {
    setTarget("");
    setReasonId("");
    setDetails("");
    setTargetError(null);
    setReasonError(null);
    setSent(null);
  }

  if (sent) {
    const childSafety = sent.reason.id === childSafetyId;
    return (
      <div className="flex flex-col gap-4 px-4 py-4">
        <div ref={confirmation} tabIndex={-1} role="status" className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-4 text-sm outline-none dark:border-zinc-700">
          <h2 className="text-lg font-semibold">Report sent</h2>
          {sent.kind === "listing" ? (
            <p>
              You reported a listing.{" "}
              <Link href={`/posts/${sent.postId}`} className="inline-flex min-h-11 items-center text-brand-text underline">
                Open the listing
              </Link>
            </p>
          ) : (
            <p>
              You reported <span className="font-semibold">@{sent.handle}</span>.
            </p>
          )}
          <p className={mutedClass}>Reason: {sent.reason.label}</p>
          <p>
            {childSafety
              ? "The owner aims to read child safety reports within 24 hours."
              : "The owner aims to read urgent reports within 24 hours and others within 3 working days."}{" "}
            The other student is not told who reported. If you are in danger now, leave the place and call 911.
          </p>
        </div>
        {sent.kind === "user" ? (
          <BlockButton handle={sent.handle} label="Block this student" className="press h-12 w-full rounded-lg border border-red-300 font-medium text-red-700 dark:border-red-900 dark:text-red-400" />
        ) : null}
        <Link href="/me/settings" className="press flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white">
          Back to Settings
        </Link>
        <button type="button" onClick={again} className="press h-12 rounded-lg border border-zinc-300 bg-white font-medium dark:border-zinc-700 dark:bg-zinc-900">
          {kind === "listing" ? "Report another listing" : "Report another student"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col pb-6">
      <p className={`px-4 pt-4 ${mutedClass}`}>
        {kind === "listing"
          ? "Open the listing, copy its link, and paste it here. The owner of the listing is not told who reported."
          : "Type the username of the student. You can find it on their profile. They are not told who reported."}
      </p>

      {kind === "listing" ? (
        <FloatingField
          label="Link to the listing"
          name="link"
          value={target}
          onChange={(value) => {
            setTarget(value);
            setTargetError(null);
          }}
          error={targetError}
          helper="A full link, or just the part from /posts/ on."
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      ) : (
        <FloatingField
          label="Username"
          name="username"
          prefix="@"
          value={target}
          onChange={(value) => {
            setTarget(value);
            setTargetError(null);
          }}
          error={targetError}
          helper="Letters, numbers, dots and underscores. The @ is optional."
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      )}

      <fieldset className="flex flex-col gap-1 px-4 pt-6" aria-describedby={reasonError ? "report-reason-error" : undefined}>
        <legend className="pb-1 text-sm font-medium">What is wrong?</legend>
        <div className={`flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-lg border dark:divide-zinc-800 ${reasonError ? "border-red-600" : "border-zinc-300 dark:border-zinc-700"}`}>
          {reasons.map((reason) => (
            <label key={reason.id} className="flex min-h-11 cursor-pointer items-start gap-3 px-3 py-3 text-base">
              <input
                type="radio"
                name="reason"
                value={reason.id}
                checked={reasonId === reason.id}
                onChange={() => {
                  setReasonId(reason.id);
                  setReasonError(null);
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              />
              <span>{reason.label}</span>
            </label>
          ))}
        </div>
        {reasonError ? (
          <p id="report-reason-error" role="alert" className={errorClass}>
            {reasonError}
          </p>
        ) : null}
        {reasonId === childSafetyId ? (
          <p className={mutedClass}>
            {kind === "listing" ? "The listing is hidden as soon as you send this. " : ""}If a child is in danger now, call 911.
          </p>
        ) : null}
      </fieldset>

      <label className="flex flex-col gap-2 px-4 pt-6">
        <span className="text-sm font-medium">Tell us more (optional)</span>
        <textarea name="details" rows={4} maxLength={DETAILS_MAX} value={details} onChange={(event) => setDetails(event.target.value)} className={fieldClass} />
        <span className="text-xs text-zinc-500">
          {details.length} of {DETAILS_MAX} characters
        </span>
      </label>

      <div className="flex flex-col gap-3 px-4 pt-4">
        {step.error ? (
          <p role="alert" className={errorClass}>
            {step.error}
          </p>
        ) : null}
        <button type="submit" disabled={step.busy} className="press h-12 rounded-lg bg-brand font-medium text-white disabled:opacity-60">
          {step.busy ? "Sending…" : "Send report"}
        </button>
      </div>
    </form>
  );
}
