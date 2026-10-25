"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { SettingsIcon } from "@/components/settings-list";

/** Chrome and Edge hand over an install prompt once; it is kept here until someone asks for it. */
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Mounted once for the whole app: the browser's install prompt can fire before any screen that wants it exists. */
export function InstallListener() {
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferred = event as InstallPromptEvent;
      notify();
    };
    const onInstalled = () => {
      deferred = null;
      installedNow = true;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

type Platform = "ios" | "android" | "other";

function platformOf(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with a touch screen.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return /Android/.test(ua) ? "android" : "other";
}

function isStandalone(): boolean {
  return installedNow || window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type InstallState = { installed: boolean; platform: Platform; canPrompt: boolean; prompt: () => Promise<void> };

// A snapshot has to be one stable value between changes.
let snapshot: { installed: boolean; platform: Platform; canPrompt: boolean } | null = null;
function read() {
  const next = { installed: isStandalone(), platform: platformOf(), canPrompt: deferred !== null };
  if (!snapshot || snapshot.installed !== next.installed || snapshot.platform !== next.platform || snapshot.canPrompt !== next.canPrompt) snapshot = next;
  return snapshot;
}
const SERVER = { installed: true, platform: "other" as Platform, canPrompt: false };

/** Whether this is already the installed app, which way to install on this device, and how to start it where the browser allows. */
export function useInstall(): InstallState {
  const state = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    read,
    () => SERVER,
  );
  return {
    ...state,
    prompt: async () => {
      const event = deferred;
      if (!event) return;
      await event.prompt();
      const choice = await event.userChoice;
      deferred = null;
      if (choice.outcome === "accepted") installedNow = true;
      notify();
    },
  };
}

/** What to do to get the app on the home screen, for this device. With a browser prompt available it is one button. */
export function InstallPanel() {
  const { platform, canPrompt, prompt } = useInstall();
  return (
    <div className="flex flex-col gap-4">
      {canPrompt ? (
        <button type="button" onClick={() => void prompt()} className="press flex h-12 items-center justify-center rounded-full bg-brand text-base font-semibold text-white">
          Install Studiskarte
        </button>
      ) : platform === "ios" ? (
        <ol className="flex flex-col gap-3 text-base">
          {["Open Studiskarte in Safari.", "Tap the Share button at the bottom of the screen.", "Choose Add to Home Screen, then Add."].map((line, i) => (
            <li key={line} className="flex items-start gap-3">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      ) : (
        <ol className="flex flex-col gap-3 text-base">
          {[platform === "android" ? "Open the browser menu (the three dots)." : "Open your browser menu.", "Choose Install app or Add to Home screen.", "Open Studiskarte from your home screen."].map((line, i) => (
            <li key={line} className="flex items-start gap-3">
              <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">It opens full screen like an app, loads faster, and sits next to your other apps. There is nothing to download from a store.</p>
    </div>
  );
}

/** A sheet with the install steps. */
export function InstallSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} label="Add Studiskarte to your home screen">
      <div className="flex flex-col gap-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl font-bold tracking-tight">Add Studiskarte to your home screen</h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400">Use it like an app.</p>
        </div>
        <InstallPanel />
        <button type="button" onClick={() => onOpenChange(false)} className="press flex h-11 items-center justify-center text-base font-medium text-zinc-600 dark:text-zinc-400">
          Close
        </button>
      </div>
    </BottomSheet>
  );
}

const DISMISSED_KEY = "studiskarte:install-dismissed:v1";
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;

const DISMISSED_EVENT = "sk:install-dismissed";

/** True while the strip is quiet after a "Not now". Follows a dismissal made in this tab or another. */
function useQuiet(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener(DISMISSED_EVENT, onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(DISMISSED_EVENT, onChange);
      };
    },
    () => {
      try {
        return Date.now() < Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
      } catch {
        return false;
      }
    },
    () => true,
  );
}

/** A small strip on the feed asking once in a while, never for the installed app, and quiet for two weeks after "Not now". */
export function InstallStrip() {
  const { installed } = useInstall();
  const quiet = useQuiet();
  const [sheet, setSheet] = useState(false);

  if (installed || quiet) return null;
  return (
    <>
      <section aria-label="Install the app" className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="text-sm font-semibold">Add Studiskarte to your home screen</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Opens full screen, like an app.</p>
        </div>
        <button type="button" onClick={() => setSheet(true)} className="press flex h-11 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white">
          Add
        </button>
        <button
          type="button"
          aria-label="Not now"
          onClick={() => {
            try {
              localStorage.setItem(DISMISSED_KEY, String(Date.now() + QUIET_MS));
            } catch {
              // Storage blocked: it will ask again next visit.
            }
            window.dispatchEvent(new Event(DISMISSED_EVENT));
          }}
          className="press -mr-1 flex h-11 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </section>
      <InstallSheet open={sheet} onOpenChange={setSheet} />
    </>
  );
}

/** The Settings row that opens the install steps; gone once this is the installed app. */
export function InstallRow() {
  const { installed } = useInstall();
  const [open, setOpen] = useState(false);
  if (installed) return null;
  return (
    <li>
      <button type="button" onClick={() => setOpen(true)} className="press-row flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-base">
        <SettingsIcon name="link" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">Add to home screen</span>
          <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">Use Studiskarte like an app.</span>
        </span>
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <InstallSheet open={open} onOpenChange={setOpen} />
    </li>
  );
}
