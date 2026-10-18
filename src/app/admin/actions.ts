"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { dismissPostReports, dismissStudentReports, removePost, restorePost, restoreStudent, suspendStudent } from "@/lib/safety/admin";

type Outcome = { ok: boolean; error?: string };

const idSchema = z.uuid();
const GONE: Outcome = { ok: false, error: "That could not be found." };

// Each function in the library checks the admin flag again; requireAdmin here also gives non-admins a 404.

async function act(name: string, id: unknown, run: (adminId: string, id: string) => Promise<Outcome>): Promise<Outcome> {
  try {
    const admin = await requireAdmin();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return GONE;
    const result = await run(admin.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A redirect or "not found" thrown on purpose belongs to the framework.
    unstable_rethrow(error);
    console.error(`admin action ${name} failed`, error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}

/** Puts a hidden post back, and clears its reports. */
export async function restorePostAction(postId: unknown): Promise<Outcome> {
  return act("restore-post", postId, restorePost);
}

/** Removes a post for good and ends its reservations. */
export async function removePostAction(postId: unknown): Promise<Outcome> {
  return act("remove-post", postId, removePost);
}

/** Closes a post's reports without acting on them. */
export async function dismissPostReportsAction(postId: unknown): Promise<Outcome> {
  return act("dismiss-post", postId, dismissPostReports);
}

/** Closes a student's reports without acting on them. */
export async function dismissStudentReportsAction(studentId: unknown): Promise<Outcome> {
  return act("dismiss-student", studentId, dismissStudentReports);
}

/** Suspends a student: they are signed out everywhere and cannot sign in. */
export async function suspendStudentAction(studentId: unknown): Promise<Outcome> {
  return act("suspend-student", studentId, suspendStudent);
}

/** Lets a suspended student back in. */
export async function restoreStudentAction(studentId: unknown): Promise<Outcome> {
  return act("restore-student", studentId, restoreStudent);
}
