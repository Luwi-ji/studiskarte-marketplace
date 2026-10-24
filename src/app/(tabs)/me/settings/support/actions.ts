"use server";

import { eq } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { student } from "@/db/schema";
import { requireActiveStudent } from "@/lib/access";
import { getDb } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { consume } from "@/lib/rate-limit";
import { sendSupportMessage, SUPPORT_NOT_SENT, type SupportResult } from "@/lib/support/submit";

/**
 * Emails the owner a bug report, feedback or message from the signed-in student. The form's answers
 * come from the browser, so `kind` and `values` are checked before anything is sent.
 */
export async function sendSupportAction(kind: unknown, values: unknown): Promise<SupportResult> {
  try {
    const me = await requireActiveStudent();
    return await sendSupportMessage(
      {
        loadSender: async (studentId) => {
          const [row] = await getDb().select({ handle: student.handle, displayName: student.name, role: student.role, email: student.email }).from(student).where(eq(student.id, studentId));
          return row ?? null;
        },
        consume,
        send: sendMail,
        now: () => new Date(),
      },
      { studentId: me.id, kind, values },
    );
  } catch (error) {
    // A redirect thrown on purpose (signed out) belongs to the framework.
    unstable_rethrow(error);
    console.error("support action failed", error);
    return { ok: false, error: SUPPORT_NOT_SENT };
  }
}
