"use client";

import { useState } from "react";
import {
  addDays,
  AVAILABILITY_DAYS_AHEAD,
  AVAILABILITY_MAX,
  manilaToday,
  WEEKDAY_LABEL,
  type FieldErrors,
  type PostFields,
} from "@/lib/posts/schema";

export type AvailabilityValue = PostFields["availability"];
type Entry = AvailabilityValue[number];

// Monday first, as on most Philippine school timetables.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dateLabel = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3 py-2 text-sm ${on ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`;

function entryLabel(entry: Entry): string {
  return entry.kind === "weekly" ? `Every ${WEEKDAY_LABEL[entry.weekday]}` : dateLabel.format(new Date(`${entry.date}T00:00:00Z`));
}

function sortKey(entry: Entry): string {
  return entry.kind === "weekly" ? String(WEEK_ORDER.indexOf(entry.weekday)) : entry.date;
}

function sameTimes(entries: AvailabilityValue): boolean {
  return entries.every((e) => e.startTime === entries[0].startTime && e.endTime === entries[0].endTime);
}

/** The month grid: weeks of "YYYY-MM-DD" (or null for padding), Sunday first. */
function monthGrid(month: string): (string | null)[][] {
  const first = new Date(`${month}-01T00:00:00Z`);
  const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

function shiftMonth(month: string, by: number): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}

// Module level so React keeps the same inputs between renders (focus stays put).
function TimeRange(props: { label: string; start: string; end: string; onStart: (t: string) => void; onEnd: (t: string) => void; error?: string }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input type="time" aria-label={`${props.label} from`} value={props.start} onChange={(e) => props.onStart(e.target.value)} className={field} />
        <span className="text-zinc-500">to</span>
        <input type="time" aria-label={`${props.label} until`} value={props.end} onChange={(e) => props.onEnd(e.target.value)} className={field} />
      </div>
      {props.error ? (
        <p role="alert" className="text-sm text-red-600">
          {props.error}
        </p>
      ) : null}
    </>
  );
}

export function AvailabilityPicker({
  value,
  onChange,
  errors,
}: {
  value: AvailabilityValue;
  /** Receives an update function, so taps in quick succession build on each other. */
  onChange: (update: (current: AvailabilityValue) => AvailabilityValue) => void;
  errors: FieldErrors;
}) {
  const today = manilaToday(new Date());
  const lastDay = addDays(today, AVAILABILITY_DAYS_AHEAD);
  const [mode, setMode] = useState<"weekly" | "date">(value[0]?.kind ?? "weekly");
  const [sameTime, setSameTime] = useState(sameTimes(value));
  const [month, setMonth] = useState((value.find((e) => e.kind === "date")?.date ?? today).slice(0, 7));
  const shared = { startTime: value[0]?.startTime ?? "", endTime: value[0]?.endTime ?? "" };
  const full = value.length >= AVAILABILITY_MAX;

  const sorted = (entries: AvailabilityValue) => [...entries].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const same = (a: Entry, b: Entry) => a.kind === b.kind && sortKey(a) === sortKey(b);

  function switchMode(next: "weekly" | "date") {
    if (next === mode) return;
    setMode(next);
    // The two ways are alternatives: switching starts a fresh selection.
    onChange(() => []);
  }

  function toggle(entry: Entry) {
    onChange((current) => {
      if (current.some((e) => same(e, entry))) return current.filter((e) => !same(e, entry));
      if (current.length >= AVAILABILITY_MAX) return current;
      const times = sameTime && current.length > 0 ? { startTime: current[0].startTime, endTime: current[0].endTime } : { startTime: "", endTime: "" };
      return sorted([...current, { ...entry, ...times }]);
    });
  }

  function setTime(index: number | "all", key: "startTime" | "endTime", time: string) {
    onChange((current) => current.map((e, i) => (index === "all" || i === index ? { ...e, [key]: time } : e)));
  }

  function setSame(on: boolean) {
    setSameTime(on);
    // Turning it on gives every day the first day's time.
    if (on) onChange((current) => current.map((e) => ({ ...e, startTime: current[0].startTime, endTime: current[0].endTime })));
  }

  const entryErrors = value.map((_, i) => errors[`availability.${i}`]).filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How you give your availability">
        {(["weekly", "date"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} className={chip(mode === m)}>
            {m === "weekly" ? "Every week" : "Specific dates"}
          </button>
        ))}
      </div>

      {mode === "weekly" ? (
        <div className="flex flex-wrap gap-2" aria-label="Days of the week">
          {WEEK_ORDER.map((weekday) => {
            const on = value.some((e) => e.kind === "weekly" && e.weekday === weekday);
            return (
              <button
                key={weekday}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_LABEL[weekday]}
                disabled={!on && full}
                onClick={() => toggle({ kind: "weekly", weekday, startTime: "", endTime: "" })}
                className={`${chip(on)} disabled:opacity-40`}
              >
                {SHORT_DAY[weekday]}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={month <= today.slice(0, 7)} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center text-xl disabled:opacity-30">
              ‹
            </button>
            <span className="text-sm font-medium">{monthLabel.format(new Date(`${month}-01T00:00:00Z`))}</span>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= lastDay.slice(0, 7)} aria-label="Next month" className="flex h-11 w-11 items-center justify-center text-xl disabled:opacity-30">
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-zinc-500">
            {SHORT_DAY.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          {monthGrid(month).map((week, w) => (
            <div key={w} className="grid grid-cols-7">
              {week.map((day, d) => {
                if (!day) return <span key={d} />;
                const on = value.some((e) => e.kind === "date" && e.date === day);
                const outside = day < today || day > lastDay;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    aria-label={dateLabel.format(new Date(`${day}T00:00:00Z`))}
                    disabled={outside || (!on && full)}
                    onClick={() => toggle({ kind: "date", date: day, startTime: "", endTime: "" })}
                    className={`aspect-square min-h-11 rounded-full text-sm ${on ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900" : ""} ${day === today && !on ? "ring-1 ring-zinc-400" : ""} disabled:opacity-25`}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {value.length > 0 ? (
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sameTime} onChange={(e) => setSame(e.target.checked)} />
            Same time for every {mode === "weekly" ? "day" : "date"}
          </label>
          {sameTime ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{value.map(entryLabel).join(", ")}</span>
              <TimeRange
                label="All"
                start={shared.startTime}
                end={shared.endTime}
                onStart={(t) => setTime("all", "startTime", t)}
                onEnd={(t) => setTime("all", "endTime", t)}
                error={entryErrors[0]}
              />
            </div>
          ) : (
            value.map((entry, i) => (
              <div key={sortKey(entry) + entry.kind} className="flex flex-col gap-1">
                <span className="text-sm font-medium">{entryLabel(entry)}</span>
                <TimeRange
                  label={entryLabel(entry)}
                  start={entry.startTime}
                  end={entry.endTime}
                  onStart={(t) => setTime(i, "startTime", t)}
                  onEnd={(t) => setTime(i, "endTime", t)}
                  error={errors[`availability.${i}`]}
                />
              </div>
            ))
          )}
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        Philippine time. {value.length}/{AVAILABILITY_MAX} {mode === "weekly" ? "days" : "dates"} chosen.
      </p>
      {errors.availability ? (
        <p role="alert" className="text-sm text-red-600">
          {errors.availability}
        </p>
      ) : null}
    </div>
  );
}
