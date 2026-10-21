import type { ReactNode } from "react";
import type { DailyPoint, Ratio } from "@/lib/admin/series";

// Small building blocks shared by the admin pages. Charts are inline SVG: no chart library, nothing sent anywhere.

export const card = "flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800";
export const link = "underline decoration-zinc-400 underline-offset-2";

const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

/** "Oct 21" for a YYYY-MM-DD day key. */
export function dayLabel(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/** "Oct 21, 2026, 3:04 PM", Manila time. */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-PH");
}

/** "42%", or a dash while there is nothing to divide by. */
export function formatShare(r: Ratio): string {
  return r.share === null ? "–" : `${Math.round(r.share * 100)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1000 ** 3) return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1000 ** 2).toFixed(0)} MB`;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** A number with what it means in plain words under it. */
export function Stat({ label, value, caption }: { label: string; value: string; caption: ReactNode }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-zinc-500">{caption}</p>
    </div>
  );
}

export type ChartPart<K extends string> = { key: K; label: string; /** A text colour class: the bars and the legend swatch take its colour. */ color: string };

/** A number, what it means, and its trend chart with the day-by-day numbers folded underneath. */
export function TrendCard<K extends string>({
  title,
  value,
  caption,
  points,
  parts,
}: {
  title: string;
  value: string;
  caption: ReactNode;
  points: DailyPoint<K>[];
  parts: ChartPart<K>[];
}) {
  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </div>
      <p className="text-xs text-zinc-500">{caption}</p>
      <StackedBars points={points} parts={parts} />
      <DailyNumbers points={points} parts={parts} />
    </section>
  );
}

const SLOT = 10;
const HEIGHT = 100;

/** One bar per day, split by key. Each bar has a hover label; the table under the chart has the same numbers. */
function StackedBars<K extends string>({ points, parts }: { points: DailyPoint<K>[]; parts: ChartPart<K>[] }) {
  const peak = Math.max(0, ...points.map((p) => p.total));
  if (peak === 0) return <p className="text-sm text-zinc-500">Nothing in this period.</p>;
  const width = points.length * SLOT;
  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`Bars by day, ${dayLabel(points[0].day)} to ${dayLabel(points[points.length - 1].day)}; the busiest day had ${peak}.`} className="h-24 w-full">
        <line x1={0} x2={width} y1={HEIGHT} y2={HEIGHT} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-zinc-300 dark:stroke-zinc-700" />
        {points.map((point, i) => {
          let top = HEIGHT;
          return parts.map((part) => {
            const n = point.parts[part.key];
            if (n === 0) return null;
            const height = (n / peak) * HEIGHT;
            top -= height;
            return (
              <rect key={`${point.day}-${part.key}`} x={i * SLOT + 1} y={top} width={SLOT - 2} height={height} className={`fill-current ${part.color}`}>
                <title>{`${dayLabel(point.day)}: ${n} ${part.label}`}</title>
              </rect>
            );
          });
        })}
      </svg>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{dayLabel(points[0].day)}</span>
        <span>Busiest day: {peak}</span>
        <span>{dayLabel(points[points.length - 1].day)}</span>
      </div>
      {parts.length > 1 ? (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {parts.map((part) => (
            <li key={part.key} className="flex items-center gap-1">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm bg-current ${part.color}`} />
              <span className="text-zinc-700 dark:text-zinc-300">{part.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The numbers behind a chart, newest day first, folded away until asked for. */
function DailyNumbers<K extends string>({ points, parts }: { points: DailyPoint<K>[]; parts: ChartPart<K>[] }) {
  return (
    <details className="text-sm">
      <summary className="flex min-h-9 cursor-pointer items-center text-zinc-600 dark:text-zinc-400">Numbers by day</summary>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-left tabular-nums">
          <thead className="sticky top-0 bg-[var(--background)] text-xs text-zinc-500">
            <tr>
              <th className="py-1 pr-3 font-medium">Day</th>
              {parts.length > 1 ? parts.map((part) => (
                <th key={part.key} className="py-1 pr-3 text-right font-medium">
                  {part.label}
                </th>
              )) : null}
              <th className="py-1 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((point) => (
              <tr key={point.day} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="py-1 pr-3">{dayLabel(point.day)}</td>
                {parts.length > 1 ? parts.map((part) => (
                  <td key={part.key} className="py-1 pr-3 text-right">
                    {point.parts[part.key]}
                  </td>
                )) : null}
                <td className="py-1 text-right font-medium">{point.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A small table that scrolls sideways on a phone instead of squeezing. */
export function DataTable({ caption, head, rows, empty }: { caption: ReactNode; head: string[]; rows: ReactNode[][]; empty?: string }) {
  return (
    <section className={card}>
      <p className="text-sm font-medium">{caption}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">{empty ?? "Nothing yet."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-xs text-zinc-500">
              <tr>
                {head.map((h, i) => (
                  <th key={h} className={`py-1 font-medium ${i === 0 ? "pr-3" : "pl-3 text-right"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, r) => (
                <tr key={r} className="border-t border-zinc-200 dark:border-zinc-800">
                  {cells.map((cell, i) => (
                    <td key={i} className={`py-1.5 ${i === 0 ? "pr-3" : "pl-3 text-right"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
