"use client";

import { useRef, useState } from "react";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { SettingsSection, SettingsIcon, SettingsRow } from "@/components/settings-list";
import { createCalendarLinkAction, revokeCalendarLinkAction } from "../actions";

type Link = { url: string; webcalUrl: string };
type Ask = "renew" | "revoke" | null;

const BUTTON = "press flex h-11 w-full items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700";

/**
 * The private calendar link. The server keeps only a hash, so a link is shown
 * once, when it is made. After that the student can make a new one (the old one
 * stops working) or turn it off.
 */
export function CalendarSettings({ active }: { active: boolean }) {
  const [link, setLink] = useState<Link | null>(null);
  // What the student just did wins over the page's value until the refreshed page arrives.
  const [linked, setLinked] = useState<boolean | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const isLinked = linked ?? active;

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const result = await createCalendarLinkAction();
      if (result.ok) {
        setLink({ url: result.url, webcalUrl: result.webcalUrl });
        setLinked(true);
        setAsk(null);
        setCopyHint(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not make the link. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const result = await revokeCalendarLinkAction();
      if (result.ok) {
        setLink(null);
        setLinked(false);
        setAsk(null);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Could not turn off the link. Try again.");
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

  return (
    <div id="calendar" className="flex flex-col">
      <div className="flex flex-col items-center gap-2 px-6 pb-2 pt-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/15 text-brand-text">
          <SettingsIcon name="calendar" className="h-8 w-8" />
        </span>
        <p className="text-lg font-semibold">{isLinked ? "Linked" : "Not linked"}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Add your scheduled handovers to Google or iPhone Calendar, as &ldquo;Studiskarte transactions&rdquo;. Changes and cancellations update by themselves (Google Calendar can take several hours). Only you can use the link.
        </p>
      </div>

      {link ? (
        <div className="flex flex-col gap-2 px-4 pt-3">
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
          {copyHint ? (
            <p role="status" className="text-sm text-zinc-600 dark:text-zinc-400">
              {copyHint}
            </p>
          ) : null}
          <a href={link.webcalUrl} className={BUTTON}>
            Add to iPhone Calendar
          </a>
        </div>
      ) : isLinked ? (
        <p className="px-4 pt-3 text-sm text-zinc-600 dark:text-zinc-400">A link is active. For your safety it can&apos;t be shown again. Make a new link to copy it.</p>
      ) : null}

      {error && ask === null ? (
        <p role="alert" className="px-4 pt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <SettingsSection>
          {isLinked ? (
            <>
              <SettingsRow icon={<SettingsIcon name="refresh" />} label="Make a new link" onClick={() => { setError(null); setAsk("renew"); }} />
              <SettingsRow icon={<SettingsIcon name="off" />} label="Turn off the link" danger onClick={() => { setError(null); setAsk("revoke"); }} />
            </>
          ) : (
            <SettingsRow icon={<SettingsIcon name="link" />} label="Make a link" disabled={busy} onClick={() => void make()} />
          )}
        </SettingsSection>
      </div>

      <SettingsSection label="How to add it">
        <li className="flex flex-col gap-1 px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
          <p>
            <span className="font-medium text-[var(--foreground)]">Google Calendar:</span> Other calendars, From URL, paste the link.
          </p>
          <p>
            <span className="font-medium text-[var(--foreground)]">iPhone:</span> right after making a link, tap Add to iPhone Calendar.
          </p>
        </li>
      </SettingsSection>

      <ConfirmSheet
        open={ask === "renew"}
        onOpenChange={(open) => !open && setAsk(null)}
        title="Make a new link?"
        confirmLabel="Yes, make a new one"
        cancelLabel="Keep it"
        busy={busy}
        error={error}
        onConfirm={() => void make()}
      >
        The old link will stop working.
      </ConfirmSheet>
      <ConfirmSheet
        open={ask === "revoke"}
        onOpenChange={(open) => !open && setAsk(null)}
        title="Turn off the link?"
        confirmLabel="Yes, turn it off"
        cancelLabel="Keep it"
        danger
        busy={busy}
        error={error}
        onConfirm={() => void turnOff()}
      >
        The link will stop working.
      </ConfirmSheet>
    </div>
  );
}
