"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { requireActiveStudent } from "@/lib/access";
import { createCalendarToken, revokeCalendarToken } from "@/lib/calendar/token";
import { changeDisplayName, changeHandle } from "@/lib/identity/profile";
import { unstable_rethrow } from "next/navigation";
import { signOut } from "@/app/(public)/sign-in/actions";
import { deleteAccount } from "@/lib/identity/delete-account";
import { confirmSchoolEmail, requestSchoolEmailCode } from "@/lib/identity/school-link";
import { getIdStore, getObjectStore } from "@/lib/images/store";
import { sendAlertAfterResponse } from "@/lib/notifications/push/schedule";
import { verificationEnabled } from "@/lib/verification/config";
import { eq } from "drizzle-orm";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { checkDisplayName, checkHandle, HANDLE_PROBLEM_MESSAGE } from "@/lib/identity/names";

export type HandleAvailability = { ok: true; handle: string } | { ok: false; message: string };

/** Whether a handle is well formed and free. Another student's own current handle counts as taken; yours counts as free. */
export async function checkHandleAction(raw: unknown): Promise<HandleAvailability> {
  const me = await requireActiveStudent();
  const checked = checkHandle(typeof raw === "string" ? raw.slice(0, 64) : "");
  if (!checked.ok) return { ok: false, message: HANDLE_PROBLEM_MESSAGE[checked.problem] };
  if (checked.handle === me.handle) return { ok: true, handle: checked.handle };
  const [taken] = await getDb().select({ id: student.id }).from(student).where(eq(student.handle, checked.handle)).limit(1);
  return taken ? { ok: false, message: "That handle is taken. Choose another." } : { ok: true, handle: checked.handle };
}

export type SaveProfileResult = { ok: true } | { ok: false; errors: { displayName?: string; handle?: string } };

/**
 * Saves what the Edit profile page staged: a new display name and/or handle (the picture goes through /api/me/avatar).
 * Both are checked before either is written, so a bad name does not leave a handle changed.
 */
export async function saveProfileAction(input: { displayName?: string; handle?: string }): Promise<SaveProfileResult> {
  const me = await requireActiveStudent();
  const errors: { displayName?: string; handle?: string } = {};
  if (input.displayName !== undefined) {
    const name = checkDisplayName(String(input.displayName));
    if (!name.ok) errors.displayName = name.message;
  }
  if (input.handle !== undefined) {
    const handle = await checkHandleAction(input.handle);
    if (!handle.ok) errors.handle = handle.message;
  }
  if (errors.displayName || errors.handle) return { ok: false, errors };

  // The handle first: it is the one that can still be refused (taken a moment ago, 30-day wait).
  if (input.handle !== undefined) {
    const result = await changeHandle(me.id, String(input.handle));
    if (!result.ok) return { ok: false, errors: { handle: result.message } };
  }
  if (input.displayName !== undefined) {
    const result = await changeDisplayName(me.id, String(input.displayName));
    if (!result.ok) return { ok: false, errors: { displayName: result.message } };
  }
  refresh();
  return { ok: true };
}

export type CalendarLinkResult = { ok: true; url: string; webcalUrl: string } | { ok: false; error: string };

/** Makes a new private calendar link, replacing any old one. The link is returned once and never stored. */
export async function createCalendarLinkAction(): Promise<CalendarLinkResult> {
  const me = await requireActiveStudent();
  try {
    const token = await createCalendarToken(me.id);
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const url = `${proto}://${host}/calendar/${token}.ics`;
    refresh();
    return { ok: true, url, webcalUrl: url.replace(/^https?:/, "webcal:") };
  } catch (error) {
    console.error("calendar link create failed", error);
    return { ok: false, error: "Could not make the link. Try again." };
  }
}

/** Turns the private calendar link off. */
export async function revokeCalendarLinkAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireActiveStudent();
  try {
    await revokeCalendarToken(me.id);
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("calendar link revoke failed", error);
    return { ok: false, error: "Could not turn off the link. Try again." };
  }
}

/**
 * Deletes the signed-in student's account for good once they typed their handle.
 * Their sessions are gone in the same step; signing out here also clears this
 * browser's cookie.
 */
export async function deleteAccountAction(confirmHandle: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const me = await requireActiveStudent();
    const result = await deleteAccount({
      studentId: me.id,
      confirmHandle: typeof confirmHandle === "string" ? confirmHandle.slice(0, 64) : "",
      store: getObjectStore(),
      idStore: verificationEnabled() ? getIdStore() : undefined,
      alert: sendAlertAfterResponse,
    });
    if (!result.ok) return result;
    await signOut().catch(() => {});
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("delete account failed", error);
    return { ok: false, error: "Something went wrong on our side. Nothing was deleted. Try again in a moment." };
  }
}

export type SchoolEmailState =
  | { step: "email"; error?: string }
  | { step: "code"; email: string; error?: string };

/** A visitor asks for a code at a school email. */
export async function requestSchoolEmailAction(_prev: SchoolEmailState, formData: FormData): Promise<SchoolEmailState> {
  const me = await requireActiveStudent();
  try {
    const result = await requestSchoolEmailCode({ studentId: me.id, rawEmail: String(formData.get("email") ?? ""), headers: await headers() });
    return result.ok ? { step: "code", email: result.email } : { step: "email", error: result.error };
  } catch (error) {
    unstable_rethrow(error);
    console.error("school email code failed", error);
    return { step: "email", error: "Something went wrong. Try again." };
  }
}

/** The right code attaches the school email and sets the role. */
export async function confirmSchoolEmailAction(_prev: SchoolEmailState, formData: FormData): Promise<SchoolEmailState> {
  const me = await requireActiveStudent();
  const email = String(formData.get("email") ?? "");
  try {
    const result = await confirmSchoolEmail({ studentId: me.id, rawEmail: email, code: String(formData.get("code") ?? ""), role: formData.get("role") });
    if (!result.ok) return { step: "code", email, error: result.error };
  } catch (error) {
    unstable_rethrow(error);
    console.error("attaching a school email failed", error);
    return { step: "code", email, error: "Something went wrong. Try again." };
  }
  refresh();
  return { step: "email" };
}
