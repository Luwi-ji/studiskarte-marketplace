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
import { getObjectStore } from "@/lib/images/store";
import { sendAlertAfterResponse } from "@/lib/notifications/push/schedule";

export type FieldState = { value: string; error?: string; saved?: boolean };

export async function saveDisplayName(_prev: FieldState, formData: FormData): Promise<FieldState> {
  const value = String(formData.get("displayName") ?? "");
  const me = await requireActiveStudent();
  const result = await changeDisplayName(me.id, value);
  if (!result.ok) return { value, error: result.message };
  refresh();
  return { value: value.trim(), saved: true };
}

export async function saveHandle(_prev: FieldState, formData: FormData): Promise<FieldState> {
  const value = String(formData.get("handle") ?? "");
  const me = await requireActiveStudent();
  const result = await changeHandle(me.id, value);
  if (!result.ok) return { value, error: result.message };
  refresh();
  return { value: value.trim().replace(/^@/, "").toLowerCase(), saved: true };
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
