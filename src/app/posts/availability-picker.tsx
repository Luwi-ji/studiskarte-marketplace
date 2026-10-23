"use client";

import { useEffect, useRef, useState } from "react";
import { MEETUP_FIRST, MEETUP_LAST } from "@/lib/deals/handover";
import {
  DAY_SHORTCUTS,
  DEFAULT_TIMES,
  sameDays,
  SHORT_DAY,
  shortTime,
  summarizeAvailability,
  timePresets,
  timeProblem,
  WEEK_ORDER,
} from "@/lib/posts/form-summary";
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

const dateLabel = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });

const field =
  "w-full rounded-lg border border-zinc-300 bg-white min-h-11 px-3 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const chip = (on: boolean) =>
  `flex min-h-11 items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition-colors duration-100 motion-reduce:transition-none ${on ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`;

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

type TimeEditorProps = {
  label: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  error?: string;
  meetup: boolean;
  compact?: boolean;
};

// Module level so React keeps the same inputs between renders (focus stays put).
/** Quick ranges, then the two native time inputs (a wheel on a phone). `meetup`: only meet-up hours are accepted. */
function TimeEditor({ label, start, end, onChange, error, meetup, compact = false }: TimeEditorProps) {
  const limits = meetup ? { min: MEETUP_FIRST, max: MEETUP_LAST } : {};
  const presets = timePresets(meetup);
  return (
    <div className="flex flex-col gap-2">
      <div role="group" aria-label={`${label} quick times`} className={compact ? "grid grid-cols-4 gap-1" : "grid grid-cols-2 gap-2"}>
        {presets.map((preset) => {
          const on = start === preset.start && end === preset.end;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(preset.start, preset.end)}
              className={`flex flex-col items-center justify-center rounded-lg border px-2 text-center transition-colors duration-100 motion-reduce:transition-none ${compact ? "min-h-11 text-xs" : "min-h-14 text-sm"} ${on ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              <span className="font-medium">{preset.label}</span>
              {compact ? null : <span className={`text-xs ${on ? "text-white/80" : "text-zinc-500"}`}>{preset.id === "all-day" && !meetup ? "Any time" : `${shortTime(preset.start)} to ${shortTime(preset.end)}`}</span>}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          From
          <input type="time" aria-label={`${label} from`} aria-invalid={error ? true : undefined} value={start} onChange={(e) => onChange(e.target.value, end)} className={field} {...limits} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          Until
          <input type="time" aria-label={`${label} until`} aria-invalid={error ? true : undefined} value={end} onChange={(e) => onChange(start, e.target.value)} className={field} {...limits} />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AvailabilityPicker({
  value,
  onChange,
  errors,
  meetup,
}: {
  value: AvailabilityValue;
  /** Receives an update function, so taps in quick succession build on each other. */
  onChange: (update: (current: AvailabilityValue) => AvailabilityValue) => void;
  errors: FieldErrors;
  /** The post offers meet-ups, so times are limited to meet-up hours. */
  meetup: boolean;
}) {
  const today = manilaToday(new Date());
  const lastDay = addDays(today, AVAILABILITY_DAYS_AHEAD);
  const [mode, setMode] = useState<"weekly" | "date">(value[0]?.kind ?? "weekly");
  const [sameTime, setSameTime] = useState(sameTimes(value));
  const [month, setMonth] = useState((value.find((e) => e.kind === "date")?.date ?? today).slice(0, 7));
  // The times the last chosen day had: a day added after the list was emptied starts with them.
  const lastTimes = useRef(value[0] ? { startTime: value[0].startTime, endTime: value[0].endTime } : DEFAULT_TIMES);
  useEffect(() => {
    if (value[0]?.startTime && value[0].endTime) lastTimes.current = { startTime: value[0].startTime, endTime: value[0].endTime };
  }, [value]);
  const full = value.length >= AVAILABILITY_MAX;
  const weekdays = value.flatMap((e) => (e.kind === "weekly" ? [e.weekday] : []));

  const sorted = (entries: AvailabilityValue) => [...entries].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const same = (a: Entry, b: Entry) => a.kind === b.kind && sortKey(a) === sortKey(b);
  const timesFor = (current: AvailabilityValue) => (current[0] ? { startTime: current[0].startTime, endTime: current[0].endTime } : lastTimes.current);

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
      return sorted([...current, { ...entry, ...timesFor(current) }]);
    });
  }

  /** A shortcut chooses exactly those weekdays (keeping the times of days that stay); tapping the one in force clears them. */
  function chooseDays(days: readonly number[]) {
    onChange((current) => {
      const now = current.flatMap((e) => (e.kind === "weekly" ? [e.weekday] : []));
      if (sameDays(now, days)) return [];
      const times = timesFor(current);
      return sorted(days.map((weekday): Entry => current.find((e) => e.kind === "weekly" && e.weekday === weekday) ?? { kind: "weekly", weekday, ...times }));
    });
  }

  function setTimes(index: number | "all", startTime: string, endTime: string) {
    onChange((current) => current.map((e, i) => (index === "all" || i === index ? { ...e, startTime, endTime } : e)));
  }

  function setSame(on: boolean) {
    setSameTime(on);
    // Turning it on gives every day the first day's time.
    if (on) onChange((current) => current.map((e) => ({ ...e, startTime: current[0].startTime, endTime: current[0].endTime })));
  }

  const unit = mode === "weekly" ? "day" : "date";
  // What the server would say, as it is typed; the server's own answer after a failed save stands in until the student changes something.
  const problem = (entry: Entry, index: number) => timeProblem(entry, meetup) ?? errors[`availability.${index}`];

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <p aria-live="polite" className="rounded-lg bg-brand/10 px-3 py-2 text-sm font-medium text-brand-text">
        {summarizeAvailability(value)}
      </p>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How you give your availability">
        {(["weekly", "date"] as const).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => switchMode(m)} className={chip(mode === m)}>
            {m === "weekly" ? "Every week" : "Specific dates"}
          </button>
        ))}
      </div>

      {mode === "weekly" ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Day shortcuts">
            {DAY_SHORTCUTS.map((shortcut) => (
              <button key={shortcut.id} type="button" aria-pressed={sameDays(weekdays, shortcut.days)} onClick={() => chooseDays(shortcut.days)} className={chip(sameDays(weekdays, shortcut.days))}>
                {shortcut.label}
              </button>
            ))}
          </div>
          {/* Seven chips share the width; the grid reaches a little into the margin so each stays close to a 44 px target on the narrowest phones. */}
          <div className="-mx-2 grid grid-cols-7" role="group" aria-label="Days of the week">
            {WEEK_ORDER.map((weekday) => {
              const on = weekdays.includes(weekday);
              return (
                <button
                  key={weekday}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_LABEL[weekday]}
                  disabled={!on && full}
                  onClick={() => toggle({ kind: "weekly", weekday, startTime: "", endTime: "" })}
                  className="flex min-h-11 items-center justify-center disabled:opacity-40"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition-colors duration-100 motion-reduce:transition-none ${on ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`}>{SHORT_DAY[weekday]}</span>
                </button>
              );
            })}
          </div>
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
                    className={`aspect-square min-h-11 rounded-full text-sm ${on ? "bg-brand text-white" : ""} ${day === today && !on ? "ring-1 ring-zinc-400" : ""} disabled:opacity-25`}
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
          <label className="flex min-h-11 items-center justify-between gap-3 text-base font-medium">
            Same time every {unit}
            <input className="h-5 w-5 shrink-0" type="checkbox" checked={sameTime} onChange={(e) => setSame(e.target.checked)} />
          </label>
          {meetup ? <p className="text-xs text-zinc-500">Meet-ups are between 6:00 AM and 8:00 PM.</p> : null}
          {sameTime ? (
            <TimeEditor
              label="All"
              start={value[0].startTime}
              end={value[0].endTime}
              onChange={(start, end) => setTimes("all", start, end)}
              meetup={meetup}
              error={problem(value[0], 0)}
            />
          ) : (
            value.map((entry, i) => (
              <div key={sortKey(entry) + entry.kind} className="flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <span className="text-sm font-medium">{entryLabel(entry)}</span>
                <TimeEditor label={entryLabel(entry)} start={entry.startTime} end={entry.endTime} onChange={(start, end) => setTimes(i, start, end)} meetup={meetup} error={problem(entry, i)} compact />
              </div>
            ))
          )}
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        Philippine time. {value.length}/{AVAILABILITY_MAX} {unit}s chosen.
      </p>
      {errors.availability ? (
        <p role="alert" className="text-sm text-red-600">
          {errors.availability}
        </p>
      ) : null}
    </div>
  );
}
