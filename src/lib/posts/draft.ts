import type { FormPhoto, PostFormValues } from "@/app/posts/post-form";
import type { PostKind } from "@/lib/posts/schema";

/** Bump when the saved shape changes; a draft with another version is ignored. */
export const DRAFT_VERSION = 1;
/** A draft older than this is not offered again. */
export const DRAFT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
/** How long after the last edit the form is saved on this device (ms). */
export const DRAFT_DEBOUNCE_MS = 600;
/** Sent on `window` when a draft is written or removed in this tab, so the chooser's hint follows. */
export const DRAFT_EVENT = "studiskarte:draft";

/** One draft per student and kind on this device. Not signed in: `anon`. */
export function draftKey(studentId: string | null | undefined, kind: PostKind): string {
  return `studiskarte:draft:${studentId || "anon"}:${kind}`;
}

export type LoadedDraft = { savedAt: number; values: Partial<PostFormValues> };

/** The text to store: the version, the kind, when it was saved and the form's values (uploaded photos as ids, picture links and captions). */
export function serializeDraft(kind: PostKind, values: PostFormValues, now: number): string {
  return JSON.stringify({ version: DRAFT_VERSION, kind, savedAt: now, values });
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isFlag = (value: unknown): value is boolean => typeof value === "boolean";

const TEXT_KEYS = ["title", "description", "categoryId", "priceAmount", "quantity", "meetupLocation", "paymentNote"] as const;
const FLAG_KEYS = ["unlimited", "exchangeMeetup", "exchangeDelivery", "paymentCash", "paymentOnline", "paymentOther", "allowNonStudents"] as const;

function photosFrom(value: unknown): FormPhoto[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<string>();
  const photos: FormPhoto[] = [];
  for (const item of value) {
    if (!isObject(item) || !isText(item.id) || !isText(item.thumbUrl) || !isText(item.caption) || item.id === "") return null;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    photos.push({ id: item.id, thumbUrl: item.thumbUrl, caption: item.caption });
  }
  return photos;
}

function availabilityFrom(value: unknown): PostFormValues["availability"] | null {
  if (!Array.isArray(value)) return null;
  const entries: PostFormValues["availability"] = [];
  for (const item of value) {
    if (!isObject(item) || !isText(item.startTime) || !isText(item.endTime)) return null;
    if (item.kind === "weekly" && typeof item.weekday === "number" && Number.isInteger(item.weekday)) {
      entries.push({ kind: "weekly", weekday: item.weekday, startTime: item.startTime, endTime: item.endTime });
    } else if (item.kind === "date" && isText(item.date)) {
      entries.push({ kind: "date", date: item.date, startTime: item.startTime, endTime: item.endTime });
    } else {
      return null;
    }
  }
  return entries;
}

/** The form values a draft holds. Missing fields are left out; a field of the wrong type makes the whole draft unusable (null). */
function valuesFrom(raw: Record<string, unknown>): Partial<PostFormValues> | null {
  const out: Partial<PostFormValues> = {};
  for (const key of TEXT_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (!isText(value)) return null;
    out[key] = value;
  }
  for (const key of FLAG_KEYS) {
    if (!(key in raw)) continue;
    const value = raw[key];
    if (!isFlag(value)) return null;
    out[key] = value;
  }
  if ("priceKind" in raw) {
    if (raw.priceKind !== "amount" && raw.priceKind !== "free") return null;
    out.priceKind = raw.priceKind;
  }
  if ("condition" in raw) {
    if (raw.condition !== null && !isText(raw.condition)) return null;
    // Whether it is still a known condition is checked where the values are used.
    out.condition = raw.condition as PostFormValues["condition"];
  }
  if ("availability" in raw) {
    const entries = availabilityFrom(raw.availability);
    if (!entries) return null;
    out.availability = entries;
  }
  if ("photos" in raw) {
    const photos = photosFrom(raw.photos);
    if (!photos) return null;
    out.photos = photos;
  }
  return out;
}

/**
 * Reads what `serializeDraft` wrote. Anything unusable gives null, never an error: not JSON, another version or kind,
 * no valid save time, older than 14 days, or values of the wrong type. A save time a little in the future (a clock that
 * moved back) counts as now.
 */
export function parseDraft(text: string | null, kind: PostKind, now: number): LoadedDraft | null {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data) || data.version !== DRAFT_VERSION || data.kind !== kind) return null;
  const { savedAt, values } = data;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt) || !isObject(values)) return null;
  if (now - savedAt > DRAFT_MAX_AGE_MS) return null;
  const parsed = valuesFrom(values);
  if (!parsed || Object.keys(parsed).length === 0) return null;
  return { savedAt: Math.min(savedAt, now), values: parsed };
}

/** When a draft was saved, in words: "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago". */
export function savedAgo(savedAt: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - savedAt) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// The browser's storage. Every call is safe where storage is missing, full or blocked (a private tab, an old browser).

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The stored draft, or null. An expired or unreadable one is removed. */
export function loadDraft(studentId: string | null | undefined, kind: PostKind, now = Date.now()): LoadedDraft | null {
  const storage = store();
  if (!storage) return null;
  try {
    const key = draftKey(studentId, kind);
    const text = storage.getItem(key);
    const draft = parseDraft(text, kind, now);
    if (text !== null && !draft) storage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

/** Is there a draft worth offering? Reads only. */
export function hasDraft(studentId: string | null | undefined, kind: PostKind, now = Date.now()): boolean {
  const storage = store();
  if (!storage) return false;
  try {
    return parseDraft(storage.getItem(draftKey(studentId, kind)), kind, now) !== null;
  } catch {
    return false;
  }
}

export function saveDraft(studentId: string | null | undefined, kind: PostKind, values: PostFormValues, now = Date.now()) {
  try {
    store()?.setItem(draftKey(studentId, kind), serializeDraft(kind, values, now));
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // Storage full or blocked: the form still works, it just is not kept.
  }
}

export function clearDraft(studentId: string | null | undefined, kind: PostKind) {
  const storage = store();
  if (!storage) return;
  try {
    const key = draftKey(studentId, kind);
    if (storage.getItem(key) === null) return;
    storage.removeItem(key);
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // Nothing to do.
  }
}
