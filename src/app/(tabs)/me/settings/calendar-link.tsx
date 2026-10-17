"use client";

import { useRef, useState } from "react";
import { createCalendarLinkAction, revokeCalendarLinkAction } from "./actions";

type Link = { url: string; webcalUrl: string };
type Which = "create" | "renew" | "revoke";

const BUTTON = "flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium disabled:opacity-60 dark:border-zinc-700";
const PRIMARY = "flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900";

/**
 * The private calendar link. The server keeps only a hash, so a link is shown
 * once, when it is made. After that the student can make a new one (the old one
 * stops working) or turn it off.
 */
export function CalendarLink({ active }: { active: boolean }) {
  const [link, setLink] = useState<Link | null>(null);
  const [confirming, setConfirming] = useState<Which | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ which: Which; message: string } | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function make(which: Which) {
    setBusy(true);
    setError(null);
    try {
      const result = await createCalendarLinkAction();
      if (result.ok) {
        setLink({ url: result.url, webcalUrl: result.webcalUrl });
        setConfirming(null);
        setCopyHint(null);
      } else {
        setError({ which, message: result.error });
      }
    } catch {
      setError({ which, message: "Could not make the link. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const result = await revokeCalendarLinkAction();
      if (result.ok) setConfirming(null);
      else setError({ which: "revoke", message: result.error });
    } catch {
      setError({ which: "revoke", message: "Could not turn off the link. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopyHint("Copied");
    } catch {
      input.current?.focus();
      input.current?.select();
      setCopyHint("Press and hold to copy");
    }
  }

  const errorFor = (which: Which) =>
    error?.which === which ? (
      <p role="alert" className="text-sm text-red-600">
        {error.message}
      </p>
    ) : null;

  return (
    <div id="calendar" className="flex scroll-mt-16 flex-col gap-2">
      <h2 className="text-sm font-medium">Calendar</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Add your scheduled handovers to Google or iPhone Calendar, as &ldquo;Studiskarte transactions&rdquo;. Changes and cancellations update by themselves (Google Calendar can take several hours). Only you can use the link.
      </p>

      {link ? (
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            readOnly
            value={link.url}
            aria-label="Calendar link"
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 text-sm dark:border-zinc-700"
          />
          <button type="button" onClick={copy} className={BUTTON}>
            Copy link
          </button>
          {copyHint ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{copyHint}</p> : null}
          <a href={link.webcalUrl} className={BUTTON}>
            Add to iPhone Calendar
          </a>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Google Calendar: Other calendars, From URL, paste the link.</p>
        </div>
      ) : !active ? (
        <>
          {errorFor("create")}
          <button type="button" disabled={busy} onClick={() => make("create")} className={PRIMARY}>
            Create calendar link
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">A link is active. For your safety it can&apos;t be shown again.</p>
          {confirming === "renew" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">The old link will stop working. Make a new one?</p>
              {errorFor("renew")}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={BUTTON}>
                  Keep it
                </button>
                <button type="button" disabled={busy} onClick={() => make("renew")} className={PRIMARY}>
                  Yes, make a new one
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => { setError(null); setConfirming("renew"); }} className={BUTTON}>
              Make a new link
            </button>
          )}
          {confirming === "revoke" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">The link will stop working. Turn it off?</p>
              {errorFor("revoke")}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => setConfirming(null)} className={BUTTON}>
                  Keep it
                </button>
                <button type="button" disabled={busy} onClick={turnOff} className={PRIMARY}>
                  Yes, turn it off
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={busy} onClick={() => { setError(null); setConfirming("revoke"); }} className={BUTTON}>
              Turn off the link
            </button>
          )}
        </div>
      )}
    </div>
  );
}
