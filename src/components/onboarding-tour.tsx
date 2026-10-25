"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SettingsIcon } from "@/components/settings-list";
import { markTourSeenAction } from "@/app/tour/actions";
import { InstallPanel, useInstall } from "@/components/install";
import { tourSteps, type TourKind } from "@/lib/tour/steps";

/**
 * A short first-time tour: one idea a step, what the person can do there, and a last step that starts their first win.
 * Shows once by itself after sign-up (`auto`); the same tour opens again from Settings. Skip is always there, and it
 * counts as seen either way.
 */
export function OnboardingTour({ kind, name, auto = false, open: openProp, onClose }: { kind: TourKind; name: string; auto?: boolean; open?: boolean; onClose?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const { installed } = useInstall();
  // The home-screen step is for a browser tab; the installed app already has it.
  const steps = tourSteps(kind, name).filter((s) => !(s.id === "install" && installed));
  const step = steps[index];
  const last = index === steps.length - 1;

  // Opens by itself for a new member, or when the parent says so (a replay).
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if ((auto || openProp) && !el.open) {
      setIndex(0);
      el.showModal();
    }
  }, [auto, openProp]);

  function finish() {
    dialog.current?.close();
    void markTourSeenAction();
    onClose?.();
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="tour-title"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/60 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90dvh] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl"
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-6 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-4">
          <ol className="flex flex-1 gap-1.5" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <li key={s.id} aria-current={i === index ? "step" : undefined} className={`h-1.5 flex-1 rounded-full transition-colors motion-reduce:transition-none ${i <= index ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-800"}`}>
                <span className="sr-only">{s.title}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={finish} className="press -mr-2 flex h-11 items-center rounded-full px-3 text-base font-medium text-zinc-600 dark:text-zinc-400">
            {last ? "Close" : "Skip"}
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-6" aria-live="polite">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10 text-brand-text">
            <SettingsIcon name={step.icon} className="h-10 w-10" />
          </span>
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Step {index + 1} of {steps.length}
            </p>
            <h2 id="tour-title" className="text-balance text-3xl font-bold leading-tight tracking-tight">
              {step.title}
            </h2>
            <p className="text-pretty text-lg text-zinc-600 dark:text-zinc-400">{step.body}</p>
          </div>
          {step.id === "install" ? <InstallPanel /> : null}
          {step.points ? (
            <ul className="flex flex-col gap-3">
              {step.points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-base">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 fill-none stroke-brand-text" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l4.2 4.2L19 7" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {last && step.cta ? (
            <Link href={step.cta.href} onClick={finish} className="press flex h-12 items-center justify-center rounded-full bg-brand text-base font-semibold text-white">
              {step.cta.label}
            </Link>
          ) : (
            <button type="button" onClick={() => setIndex((i) => i + 1)} className="press flex h-12 items-center justify-center rounded-full bg-brand text-base font-semibold text-white">
              Next
            </button>
          )}
          {index > 0 ? (
            <button type="button" onClick={() => setIndex((i) => i - 1)} className="press flex h-12 items-center justify-center rounded-full border border-zinc-300 text-base font-semibold dark:border-zinc-700">
              Back
            </button>
          ) : (
            <button type="button" onClick={finish} className="press flex h-12 items-center justify-center text-base font-medium text-zinc-600 dark:text-zinc-400">
              I will explore on my own
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}

/** The Settings row that plays the tour again. */
export function ReplayTourRow({ kind, name }: { kind: TourKind; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <li>
        <OnboardingTour kind={kind} name={name} open={open} onClose={() => setOpen(false)} />
        <button type="button" onClick={() => setOpen(true)} className="press-row flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left text-base">
          <SettingsIcon name="star" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">Take the tour again</span>
            <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">A one-minute look at what you can do here.</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </li>
    </>
  );
}
