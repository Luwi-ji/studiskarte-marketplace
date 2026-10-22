"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { sendAlertAfterResponse } from "@/lib/notifications/push/schedule";
import { alertChildSafetyReport, alertNewReport, isChildSafetyInput } from "@/lib/safety/report-alert";
import { blockStudent, unblockStudent } from "@/lib/safety/block";
import { reportPost, reportStudent, REPORT_TARGET_GONE } from "@/lib/safety/report";

type Outcome = { ok: boolean; error?: string };

const idSchema = z.uuid();
const handleSchema = z.string().trim().min(1).max(64);

// Inputs are typed as unknown: they come from the browser and are checked before anything is written.

async function act(name: string, run: (studentId: string) => Promise<Outcome>): Promise<Outcome> {
  try {
    const me = await requireActiveStudent();
    const result = await run(me.id);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A redirect or "not found" thrown on purpose belongs to the framework.
    unstable_rethrow(error);
    console.error(`safety action ${name} failed`, error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}

/** Reports a post; the third report from different students hides it until an admin looks. */
export async function reportPostAction(postId: unknown, input: unknown): Promise<Outcome> {
  return act("report-post", async (reporterId) => {
    const id = idSchema.safeParse(postId);
    if (!id.success) return { ok: false, error: REPORT_TARGET_GONE };
    const result = await reportPost({ reporterId, postId: id.data, input, alert: sendAlertAfterResponse });
    if (result.ok) after(() => (isChildSafetyInput(input) ? alertChildSafetyReport("post") : alertNewReport("post")));
    return result;
  });
}

/** Reports a student, by handle. */
export async function reportStudentAction(handle: unknown, input: unknown): Promise<Outcome> {
  return act("report-student", async (reporterId) => {
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success) return { ok: false, error: REPORT_TARGET_GONE };
    const result = await reportStudent({ reporterId, handle: parsed.data, input });
    if (result.ok) after(() => (isChildSafetyInput(input) ? alertChildSafetyReport("student") : alertNewReport("student")));
    return result;
  });
}

/** Blocks a student: neither of you sees the other any more. The other person is not told. */
export async function blockStudentAction(handle: unknown): Promise<Outcome> {
  return act("block", async (blockerId) => {
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success) return { ok: false, error: "That student could not be found." };
    const result = await blockStudent(blockerId, parsed.data, sendAlertAfterResponse);
    if (result === "self") return { ok: false, error: "You cannot block yourself." };
    if (result === "not_found") return { ok: false, error: "That student could not be found." };
    return { ok: true };
  });
}

/** Lifts a block. */
export async function unblockStudentAction(handle: unknown): Promise<Outcome> {
  return act("unblock", async (blockerId) => {
    const parsed = handleSchema.safeParse(handle);
    if (!parsed.success) return { ok: false, error: "That student could not be found." };
    await unblockStudent(blockerId, parsed.data);
    return { ok: true };
  });
}
