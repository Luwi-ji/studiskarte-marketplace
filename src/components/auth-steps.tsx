import type { ReactNode } from "react";

const STEPS = ["Email", "Confirm", "Password", "Profile"] as const;

/** The four steps of signing up, as a bar: how far along, and what comes next. */
export function StepHeader({ step, title, subtitle }: { step: 1 | 2 | 3 | 4; title: string; subtitle?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ol className="flex gap-1.5" aria-label={`Step ${step} of ${STEPS.length}`}>
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i + 1 === step ? "step" : undefined} className={`h-1.5 flex-1 rounded-full ${i + 1 <= step ? "bg-brand" : "bg-zinc-200 dark:bg-zinc-800"}`}>
              <span className="sr-only">{label}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Step {step} of {STEPS.length} · {STEPS[step - 1]}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-base text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
      </div>
    </header>
  );
}

/** Text that stays out of the way until asked for: a one-line summary that opens to the detail. */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-zinc-200 px-4 dark:border-zinc-800">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {summary}
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-zinc-500 transition-transform duration-150 group-[[open]]:rotate-90 motion-reduce:transition-none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </summary>
      <div className="flex flex-col gap-2 pb-3 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </details>
  );
}
