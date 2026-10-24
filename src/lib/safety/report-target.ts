import { checkHandle, HANDLE_PROBLEM_MESSAGE } from "@/lib/identity/names";

// What a student types on Settings, Report a listing and Report a user, turned into what the report functions take.
// Pure (no database), so the form and the server action read the same text the same way.

export const NO_LISTING_LINK = "Paste the link to the listing.";
export const BAD_LISTING_LINK = "That does not look like a link to a listing. Open the listing, copy its link, and paste it here.";
export const NO_USERNAME = "Type the username.";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const BARE_ID = new RegExp(`^${UUID}$`);
// An optional scheme and host (any host), then /posts/<id>, then nothing or a slash, query or hash.
const POST_LINK = new RegExp(`^(?:(?:https?:\\/\\/)?[^\\s/?#]+)?\\/posts\\/(${UUID})(?:[/?#]|$)`, "i");

/** The listing id in a pasted link (a full address on any host, a /posts/<id> path, or the bare id), or null. */
export function parsePostLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (BARE_ID.test(text)) return text.toLowerCase();
  const match = POST_LINK.exec(text);
  return match ? match[1].toLowerCase() : null;
}

export type ReportHandle = { ok: true; handle: string } | { ok: false; message: string };

/**
 * The handle in what a student typed: trimmed, a leading @ dropped, lowercase, checked for shape like a handle is when it is chosen.
 * A reserved word is not turned away: an account may hold one, and the report functions say whether anyone does.
 */
export function parseReportHandle(raw: unknown): ReportHandle {
  if (typeof raw !== "string" || raw.trim().replace(/^@/, "") === "") return { ok: false, message: NO_USERNAME };
  const checked = checkHandle(raw);
  if (checked.ok) return checked;
  if (checked.problem === "reserved") return { ok: true, handle: raw.trim().replace(/^@/, "").toLowerCase() };
  return { ok: false, message: HANDLE_PROBLEM_MESSAGE[checked.problem] };
}
