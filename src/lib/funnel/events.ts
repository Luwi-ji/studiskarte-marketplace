import { and, eq, isNull } from "drizzle-orm";
import { funnelEvent, student } from "@/db/schema";
import { type Executor, getDb } from "@/lib/db";
import type { Utm } from "./utm";

export const FUNNEL_STAGES = [
  "landing_view",
  "signup_started",
  "signup_completed",
  "first_listing",
  "first_message",
  "first_handover_confirmed",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

/** Student-bound stages are recorded once per student, however often the action repeats. */
export async function recordStage(
  db: Executor,
  stage: FunnelStage,
  opts: { studentId?: string; utm?: Utm | null } = {},
): Promise<void> {
  await db
    .insert(funnelEvent)
    .values({
      stage,
      studentId: opts.studentId ?? null,
      utmSource: opts.utm?.source ?? null,
      utmMedium: opts.utm?.medium ?? null,
      utmCampaign: opts.utm?.campaign ?? null,
    })
    .onConflictDoNothing({ target: [funnelEvent.studentId, funnelEvent.stage] });
}

/** Analytics must never block sign-up: failures are logged and swallowed. */
export async function recordSignupStarted(utm: Utm | null): Promise<void> {
  try {
    await recordStage(getDb(), "signup_started", { utm });
  } catch (error) {
    console.error("recording signup_started failed", error);
  }
}

export async function recordSignupCompleted(studentId: string, utm: Utm | null): Promise<void> {
  try {
    const db = getDb();
    if (utm) {
      await db
        .update(student)
        .set({ utmSource: utm.source ?? null, utmMedium: utm.medium ?? null, utmCampaign: utm.campaign ?? null })
        .where(
          and(
            eq(student.id, studentId),
            isNull(student.utmSource),
            isNull(student.utmMedium),
            isNull(student.utmCampaign),
          ),
        );
    }
    await recordStage(db, "signup_completed", { studentId, utm });
  } catch (error) {
    console.error("recording signup_completed failed", error);
  }
}
