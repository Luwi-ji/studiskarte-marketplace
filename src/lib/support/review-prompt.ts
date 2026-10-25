/** Where the device remembers what it asked. One entry for the whole device, not per account. */
export const REVIEW_PROMPT_KEY = "studiskarte:review-prompt:v1";
/** After the prompt was shown, no other for this long. */
export const REVIEW_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
/** After someone opened the review page, no prompt for this long. */
export const REVIEW_QUIET_MS = 90 * 24 * 60 * 60 * 1000;
/** A completed deal older than this is not a moment to ask about. */
export const REVIEW_MOMENT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SEEN_KEEP = 30;

export type ReviewPromptState = {
  lastShownAt?: number;
  quietUntil?: number;
  /** "Don't ask again". */
  never?: boolean;
  /** Moments already asked about (a post or a deal), so one is never asked twice. */
  seen?: string[];
};

const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** What was stored, or an empty state for anything unreadable. */
export function parseReviewState(text: string | null): ReviewPromptState {
  if (!text) return {};
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null || Array.isArray(data)) return {};
    const raw = data as Record<string, unknown>;
    return {
      ...(isTime(raw.lastShownAt) ? { lastShownAt: raw.lastShownAt } : {}),
      ...(isTime(raw.quietUntil) ? { quietUntil: raw.quietUntil } : {}),
      ...(raw.never === true ? { never: true } : {}),
      ...(Array.isArray(raw.seen) ? { seen: raw.seen.filter((k): k is string => typeof k === "string").slice(-SEEN_KEEP) } : {}),
    };
  } catch {
    return {};
  }
}

/** Whether this moment may open the prompt now. `happenedAt` is when a deal completed, if the moment is a deal. */
export function shouldPrompt(state: ReviewPromptState, momentKey: string, now: number, happenedAt?: number): boolean {
  if (state.never) return false;
  if (state.quietUntil !== undefined && now < state.quietUntil) return false;
  if (state.lastShownAt !== undefined && now - state.lastShownAt < REVIEW_COOLDOWN_MS) return false;
  if (state.seen?.includes(momentKey)) return false;
  if (happenedAt !== undefined && (!Number.isFinite(happenedAt) || now - happenedAt > REVIEW_MOMENT_MAX_AGE_MS)) return false;
  return true;
}

export function afterShown(state: ReviewPromptState, momentKey: string, now: number): ReviewPromptState {
  return { ...state, lastShownAt: now, seen: [...(state.seen ?? []), momentKey].slice(-SEEN_KEEP) };
}

export function afterReviewOpened(state: ReviewPromptState, now: number): ReviewPromptState {
  return { ...state, quietUntil: now + REVIEW_QUIET_MS };
}

export function afterNever(state: ReviewPromptState): ReviewPromptState {
  return { ...state, never: true };
}
