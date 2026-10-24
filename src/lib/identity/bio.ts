// The profile bio: one short line about a student. Pure, so the form and the server share one definition.
// The database CHECK on `student.bio` mirrors the length and the no-newline rule.

export const BIO_MAX = 160;

// Characters that reorder or hide text (bidirectional controls, zero-width spaces, the byte order mark).
// The joiners U+200D and U+200C stay: emoji sequences and some scripts need them.
const INVISIBLE = /[\u061C\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/gu;

export type BioCheck = { ok: true; bio: string | null } | { ok: false; message: string };

/**
 * Cleans a bio: control and invisible characters are dropped, every run of whitespace (newlines and tabs included)
 * becomes one space, and the ends are trimmed. Nothing left means no bio (`null`). Length counts code points, as the database does.
 */
export function checkBio(raw: string): BioCheck {
  const bio = raw
    .normalize("NFC")
    .replace(INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .replace(/\p{Cc}/gu, "")
    .trim();
  if ([...bio].length > BIO_MAX) return { ok: false, message: `Use at most ${BIO_MAX} characters.` };
  return { ok: true, bio: bio === "" ? null : bio };
}
