"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireRecentAdmin } from "@/lib/access";
import { dismissPostReports, dismissStudentReports, liftLegalHold, placeLegalHold, removePost, restorePost, restoreStudent, suspendStudent } from "@/lib/safety/admin";

type Outcome = { ok: boolean; error?: string };

const idSchema = z.uuid();
const GONE: Outcome = { ok: false, error: "That could not be found." };
const REASON_REQUIRED: Outcome = { ok: false, error: "Write a reason. It is kept in the admin record." };

// Each function in the library checks the admin flag again; requireAdmin here also gives non-admins a 404.

type Run = (adminId: string, id: string, reason: string) => Promise<Outcome>;

/** `needsReason`: removing a post or suspending a person must say why. The rest may leave it empty. */
async function act(name: string, id: unknown, reason: unknown, needsReason: boolean, run: Run): Promise<Outcome> {
  try {
    const admin = await requireRecentAdmin();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return GONE;
    const text = typeof reason === "string" ? reason.trim() : "";
    if (needsReason && text === "") return REASON_REQUIRED;
    const result = await run(admin.id, parsed.data, text);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A redirect or "not found" thrown on purpose belongs to the framework.
    unstable_rethrow(error);
    console.error(`admin action ${name} failed`, error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}

/** Puts a hidden post back, and clears its reports. The reason, if given, is shown to the owner. */
export async function restorePostAction(postId: unknown, reason?: unknown): Promise<Outcome> {
  return act("restore-post", postId, reason, false, (adminId, id, why) => restorePost(adminId, id, undefined, why));
}

/** Removes a post for good and ends its reservations. The reason is required and is shown to the owner. */
export async function removePostAction(postId: unknown, reason?: unknown): Promise<Outcome> {
  return act("remove-post", postId, reason, true, (adminId, id, why) => removePost(adminId, id, undefined, why));
}

/** Closes a post's reports without acting on them. */
export async function dismissPostReportsAction(postId: unknown, reason?: unknown): Promise<Outcome> {
  return act("dismiss-post", postId, reason, false, dismissPostReports);
}

/** Closes a student's reports without acting on them. */
export async function dismissStudentReportsAction(studentId: unknown, reason?: unknown): Promise<Outcome> {
  return act("dismiss-student", studentId, reason, false, dismissStudentReports);
}

/** Suspends a student: they are signed out everywhere and cannot sign in. The reason is required. */
export async function suspendStudentAction(studentId: unknown, reason?: unknown): Promise<Outcome> {
  return act("suspend-student", studentId, reason, true, suspendStudent);
}

/** Lets a suspended student back in. */
export async function restoreStudentAction(studentId: unknown, reason?: unknown): Promise<Outcome> {
  return act("restore-student", studentId, reason, false, restoreStudent);
}

/** Keeps an account's records: the person can no longer delete it. The reason is required. */
export async function placeLegalHoldAction(studentId: unknown, reason?: unknown): Promise<Outcome> {
  return act("place-hold", studentId, reason, true, placeLegalHold);
}

/** Lifts a hold the owner placed. */
export async function liftLegalHoldAction(studentId: unknown, reason?: unknown): Promise<Outcome> {
  return act("lift-hold", studentId, reason, false, liftLegalHold);
}
