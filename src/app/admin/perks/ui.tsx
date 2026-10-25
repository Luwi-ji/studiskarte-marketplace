import type { ReactNode } from "react";

export const field = "h-11 w-full min-w-0 rounded-xl border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700";
export const primary = "h-11 shrink-0 rounded-xl bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50";
export const quiet = "h-11 shrink-0 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";

/** A labelled input: the label stays visible while typing, with an optional hint underneath. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

/** A pick-one or pick-some chip. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-11 rounded-full border px-4 text-sm font-medium ${selected ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`}
    >
      {children}
    </button>
  );
}

/** Claimed, redeemed, expired and conversion as four small tiles. */
export function Stats({ claimed, redeemed, expired, conversion }: { claimed: number; redeemed: number; expired: number; conversion: number | null }) {
  const tiles: [string, string][] = [
    ["Claimed", String(claimed)],
    ["Redeemed", String(redeemed)],
    ["Expired", String(expired)],
    ["Used", conversion === null ? "–" : `${conversion}%`],
  ];
  return (
    <dl className="grid grid-cols-4 gap-2">
      {tiles.map(([label, value]) => (
        <div key={label} className="flex flex-col rounded-xl bg-zinc-50 px-2 py-2 text-center dark:bg-zinc-900">
          <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          <dt className="text-[0.7rem] text-zinc-500">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-red-600">
      {message}
    </p>
  ) : null;
}
