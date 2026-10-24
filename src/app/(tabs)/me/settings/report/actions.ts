"use server";

import { reportPostAction, reportStudentAction } from "@/app/safety/actions";
import { REPORT_TARGET_GONE } from "@/lib/safety/report";
import { BAD_LISTING_LINK, NO_LISTING_LINK, parsePostLink, parseReportHandle } from "@/lib/safety/report-target";

type Outcome = { ok: boolean; error?: string };

// The Settings forms read what the student typed, then hand over to the actions behind the report sheets
// (`@/app/safety/actions`), so the rules, the hourly limit, the hide-at-3 rule and the owner's alerts are the same.
// Their errors already say what is wrong (own post, already reported, too fast, details too long, no reason).
// Only "no longer available" is reworded: here the student typed the target, so it can also mean a typo.

const LISTING_GONE = "We could not find a listing to report at that link. It may be gone, or the link may be wrong. Check it and try again.";
const USER_GONE = "We could not find a student with that username. Check the spelling and try again.";

/** Reports the listing a pasted link points to. */
export async function reportListingAction(link: unknown, input: unknown): Promise<Outcome> {
  const postId = parsePostLink(link);
  if (!postId) return { ok: false, error: typeof link === "string" && link.trim() !== "" ? BAD_LISTING_LINK : NO_LISTING_LINK };
  const result = await reportPostAction(postId, input);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error === REPORT_TARGET_GONE ? LISTING_GONE : result.error };
}

/** Reports the student a typed username belongs to. */
export async function reportUserAction(username: unknown, input: unknown): Promise<Outcome> {
  const parsed = parseReportHandle(username);
  if (!parsed.ok) return { ok: false, error: parsed.message };
  const result = await reportStudentAction(parsed.handle, input);
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error === REPORT_TARGET_GONE ? USER_GONE : result.error };
}
