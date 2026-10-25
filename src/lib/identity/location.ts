// Where a person is based ("Sampaloc, Manila"): one short line, optional. Pure, so the form and the server share one
// definition. The database CHECK on `student.location` mirrors the length and the no-newline rule.

export const LOCATION_MIN = 2;
export const LOCATION_MAX = 60;

// Characters that reorder or hide text (bidirectional controls, zero-width spaces, the byte order mark).
const INVISIBLE = /[\u061C\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu;

export type LocationCheck = { ok: true; location: string | null } | { ok: false; message: string };

/** Cleans a location: control and invisible characters dropped, whitespace runs become one space, ends trimmed. Nothing left means none. */
export function checkLocation(raw: string): LocationCheck {
  const location = raw
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .replace(/\p{Cc}/gu, "")
    .trim();
  if (location === "") return { ok: true, location: null };
  const length = [...location].length;
  if (length < LOCATION_MIN) return { ok: false, message: `Use at least ${LOCATION_MIN} characters, or leave it empty.` };
  if (length > LOCATION_MAX) return { ok: false, message: `Use at most ${LOCATION_MAX} characters.` };
  return { ok: true, location };
}
