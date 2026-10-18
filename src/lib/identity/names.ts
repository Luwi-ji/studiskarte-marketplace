// Handle and display-name rules (business logic, decided 2026-10-16).
// Pure, so the form and the server share one definition. The database
// CHECKs on `student` mirror these rules.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const DISPLAY_NAME_MAX = 40;
export const HANDLE_CHANGE_DAYS = 30;

// a–z 0–9 _ in groups joined by single dots: no leading, trailing or doubled dots.
const HANDLE_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

// Words that would let someone pose as the app or its staff, or clash with
// page addresses. Compared after removing dots and underscores, so
// "admin_" and "a.dmin" are refused too.
const RESERVED: Record<string, true> = {
  admin: true,
  administrator: true,
  studiskarte: true,
  support: true,
  help: true,
  moderator: true,
  mod: true,
  official: true,
  staff: true,
  system: true,
  me: true,
  settings: true,
  api: true,
  signin: true,
  login: true,
  welcome: true,
  deleted: true,
  deletedstudent: true,
};

export type HandleProblem = "length" | "characters" | "dots" | "reserved";

export type HandleCheck = { ok: true; handle: string } | { ok: false; problem: HandleProblem };

/** Normalizes (trim, drop a leading @, lowercase) and checks a handle. */
export function checkHandle(raw: string): HandleCheck {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) return { ok: false, problem: "length" };
  if (!/^[a-z0-9._]+$/.test(handle)) return { ok: false, problem: "characters" };
  if (!HANDLE_SHAPE.test(handle)) return { ok: false, problem: "dots" };
  if (RESERVED[handle.replace(/[._]/g, "")]) return { ok: false, problem: "reserved" };
  return { ok: true, handle };
}

export const HANDLE_PROBLEM_MESSAGE: Record<HandleProblem, string> = {
  length: `Use ${HANDLE_MIN} to ${HANDLE_MAX} characters.`,
  characters: "Use only letters a–z, numbers, dots and underscores.",
  dots: "A dot can't be first, last, or next to another dot.",
  reserved: "That handle is reserved. Choose another.",
};

// Display names that would let someone pose as the app or its staff, compared after keeping only
// letters and digits. Names that merely contain "studiskarte" are refused too.
const STAFF_NAMES = new Set(["admin", "administrator", "moderator", "support", "official", "staff", "system", "deletedstudent"]);

// Characters that reorder or hide text (bidirectional controls, zero-width spaces, the byte order mark).
// The joiners U+200D and U+200C stay: emoji sequences and some scripts need them.
const INVISIBLE = /[\u061C\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu;

export type DisplayNameCheck = { ok: true; name: string } | { ok: false; message: string };

/** Trims and checks a display name. Length counts what people see, so an emoji or "ñ" is one. */
export function checkDisplayName(raw: string): DisplayNameCheck {
  const name = raw.normalize("NFC").replace(INVISIBLE, "").trim();
  if (/[\r\n]/.test(name)) return { ok: false, message: "Use one line." };
  const letters = name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  if (STAFF_NAMES.has(letters) || letters.includes("studiskarte")) return { ok: false, message: "That name is reserved. Choose another." };
  const visible = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(name)].length;
  if (visible === 0) return { ok: false, message: "Add a display name." };
  if (visible > DISPLAY_NAME_MAX) return { ok: false, message: `Use at most ${DISPLAY_NAME_MAX} characters.` };
  return { ok: true, name };
}

/** When the student may change their handle again, or null if they may now. */
export function nextHandleChangeAt(lastChangedAt: Date | null, now: Date): Date | null {
  if (!lastChangedAt) return null;
  const allowedAt = new Date(lastChangedAt.getTime() + HANDLE_CHANGE_DAYS * 24 * 60 * 60 * 1000);
  return allowedAt > now ? allowedAt : null;
}
