/**
 * Date buckets and ratios shared by the owner's admin queries. Every day is a day on the
 * Philippine calendar (Asia/Manila, UTC+8 all year: the Philippines has no daylight saving),
 * so "today" means what the owner sees on a Manila clock, not the UTC day.
 */

export const MANILA_TIME_ZONE = "Asia/Manila";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The reporting periods the owner can switch between. */
export const PERIOD_OPTIONS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_OPTIONS)[number];
export const DEFAULT_PERIOD_DAYS: PeriodDays = 30;

/** Reads `?days=` from the address; anything that is not one of the options means the default. */
export function parsePeriodDays(raw: string | string[] | undefined): PeriodDays {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PERIOD_OPTIONS.find((days) => String(days) === value) ?? DEFAULT_PERIOD_DAYS;
}

/** The Manila calendar day of an instant, as YYYY-MM-DD. */
export function manilaDay(instant: Date): string {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `days` Manila days up to and including the day of `now`. */
export type Period = {
  days: PeriodDays;
  /** Every day of the period, oldest first, as YYYY-MM-DD. */
  dayKeys: string[];
  /** The instant the first day starts (00:00 in Manila). */
  startsAt: Date;
  /** The end of the period: `now`. Today's bucket is a partial day. */
  endsAt: Date;
};

export function periodEnding(days: PeriodDays, now: Date): Period {
  const todayStart = Date.parse(`${manilaDay(now)}T00:00:00+08:00`);
  const startsAt = new Date(todayStart - (days - 1) * DAY_MS);
  const dayKeys = Array.from({ length: days }, (_, i) => manilaDay(new Date(startsAt.getTime() + i * DAY_MS)));
  return { days, dayKeys, startsAt, endsAt: now };
}

/** One day of a chart: the whole count and how it splits by key (for example by role). */
export type DailyPoint<K extends string> = { day: string; total: number; parts: Record<K, number> };

/**
 * Turns grouped rows (a day, a key and a count) into one point per day of the period, with zeros for
 * days and keys that had nothing. Rows outside the period or with an unknown key are ignored.
 */
export function fillDays<K extends string>(
  dayKeys: readonly string[],
  keys: readonly K[],
  rows: readonly { day: string; key: string; n: number }[],
): DailyPoint<K>[] {
  const points = new Map<string, DailyPoint<K>>(
    dayKeys.map((day) => [day, { day, total: 0, parts: Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number> }]),
  );
  for (const row of rows) {
    const point = points.get(row.day);
    const key = keys.find((k) => k === row.key);
    if (!point || key === undefined) continue;
    point.parts[key] += row.n;
    point.total += row.n;
  }
  return dayKeys.map((day) => points.get(day)!);
}

/** A share with its two counts. `share` is null, never NaN or Infinity, when there is nothing to divide by. */
export type Ratio = { numerator: number; denominator: number; share: number | null };

export function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, share: denominator > 0 ? numerator / denominator : null };
}
