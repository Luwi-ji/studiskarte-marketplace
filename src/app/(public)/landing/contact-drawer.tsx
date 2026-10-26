"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Turnstile } from "@/components/turnstile";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string; field?: string };

/** A button that opens a drawer with a short email form. Mail goes to the owner through /api/contact. */
export function ContactDrawer({ label = "Message us", className = "", subjectHint = "" }: { label?: string; className?: string; subjectHint?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [values, setValues] = useState({ name: "", email: "", message: subjectHint, website: "" });
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const setChallengeReady = useCallback((ready: boolean) => setTurnstileReady(ready), []);

  function open() {
    if (state.kind === "sent") setState({ kind: "idle" });
    dialog.current?.showModal();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const turnstile = String(form.get("cf-turnstile-response") ?? "");
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, turnstile }),
      });
      if (response.ok) {
        setValues({ name: "", email: "", message: "", website: "" });
        setState({ kind: "sent" });
        return;
      }
      setTurnstileReady(false);
      setTurnstileReset((value) => value + 1);
      const body = (await response.json().catch(() => ({}))) as { error?: string; field?: string };
      setState({ kind: "error", message: body.error ?? "Could not send your message. Try again.", field: body.field });
    } catch {
      setState({ kind: "error", message: "Could not send your message. Check your connection and try again." });
      setTurnstileReady(false);
      setTurnstileReset((value) => value + 1);
    }
  }

  const field = "min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base dark:border-zinc-700 dark:bg-zinc-950";
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  const invalid = (name: string) => (state.kind === "error" && state.field === name ? true : undefined);

  return (
    <>
      <button type="button" onClick={open} className={className}>
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-[var(--background)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/50 sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-md sm:rounded-none sm:rounded-l-3xl"
      >
        <div className="flex min-h-full flex-col gap-5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="text-2xl font-bold tracking-tight">
                Message us
              </h2>
              <p className="text-base text-zinc-600 dark:text-zinc-400">Shop owner, student or curious? Write to us and we will reply by email.</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {state.kind === "sent" ? (
            <div role="status" className="flex flex-col gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
              <p className="text-lg font-semibold">Sent. Thank you!</p>
              <p>We will reply to the email you gave.</p>
              <button type="button" onClick={() => dialog.current?.close()} className="press min-h-11 self-start rounded-full bg-emerald-800 px-5 font-semibold text-white">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Name <span className="font-normal text-zinc-500">(optional)</span></span>
                <input value={values.name} onChange={set("name")} maxLength={60} autoComplete="name" className={field} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Your email</span>
                <input type="email" value={values.email} onChange={set("email")} maxLength={120} autoComplete="email" inputMode="email" required aria-invalid={invalid("email")} className={field} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">Message</span>
                <textarea value={values.message} onChange={set("message")} maxLength={2000} rows={5} required aria-invalid={invalid("message")} className={`${field} py-3`} />
              </label>
              {/* A trap for robots: people never see or fill this. */}
              <input value={values.website} onChange={set("website")} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
              <Turnstile action="contact" resetKey={turnstileReset} onTokenChange={setChallengeReady} />
              {state.kind === "error" ? (
                <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                  {state.message}
                </p>
              ) : null}
              <button type="submit" disabled={state.kind === "sending" || !turnstileReady} className="press flex min-h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white disabled:opacity-60">
                {state.kind === "sending" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
