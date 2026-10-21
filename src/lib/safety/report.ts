import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { post, report, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { recordNotification, type AlertSink, type Recorded } from "@/lib/notifications/record";
import { consume } from "@/lib/rate-limit";

/** One student cannot flood the admin's queue: this many reports an hour. */
export const REPORTS_PER_HOUR = 20;
export const REPORTING_TOO_FAST = "You're reporting too fast. Try again in a while.";

const REPORT_LIMIT = { action: "report", max: REPORTS_PER_HOUR, windowSeconds: 60 * 60 };

/** How many different active students must have an open report on a post before it is hidden. */
export const REPORT_HIDE_THRESHOLD = 3;

/** The reason that hides a post on the first report: a child may be at risk (child safety standards, RA 11930). */
export const CHILD_SAFETY_REASON = "child_safety";

export const ALREADY_REPORTED = "You already reported this. We will look at it.";
export const CANT_REPORT_SELF = "You can't report yourself or your own post.";
export const REPORT_TARGET_GONE = "This is no longer available to report.";

const DETAILS_MAX = 500;

const LABELS = {
  child_safety: "A child is being harmed, or sexual content involving someone under 18",
  spam: "Spam or an advertisement",
  scam: "A scam or fraud",
  prohibited: "Something that is not allowed here",
  offensive: "Offensive content",
  harassment: "Harassment or threats",
  impersonation: "Pretending to be someone else",
  other: "Something else",
} as const;

type Reason = keyof typeof LABELS;

/** Why someone can be reported, in the order shown. The ids are what the database accepts. */
export const REPORT_REASONS: readonly { id: string; label: string }[] = (Object.keys(LABELS) as Reason[]).map((id) => ({ id, label: LABELS[id] }));

export type ReportResult = { ok: true; hidden: boolean } | { ok: false; error: string };

const inputSchema = z.object({
  reason: z.enum(Object.keys(LABELS) as [Reason, ...Reason[]]),
  details: z.string().optional(),
});

/** The reason and the details as stored, or the message to show. */
function parseInput(input: unknown): { ok: true; reason: Reason; details: string | null } | { ok: false; error: string } {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose what is wrong." };
  const details = (parsed.data.details ?? "").trim();
  if (details.length > DETAILS_MAX) return { ok: false, error: `Use at most ${DETAILS_MAX} characters.` };
  return { ok: true, reason: parsed.data.reason, details: details || null };
}

/**
 * A student reports a post. One open report each. The moment
 * REPORT_HIDE_THRESHOLD different active students have an open report on an open or
 * reserved post, it is hidden pending the admin's decision (the owner is told once).
 * A child safety report hides the post at once, on one report.
 * The post row is locked first, so three reports arriving together hide it exactly once.
 * A deal on a hidden post carries on.
 */
export async function reportPost(args: { reporterId: string; postId: string; input: unknown; alert?: AlertSink }): Promise<ReportResult> {
  const parsed = parseInput(args.input);
  if (!parsed.ok) return parsed;
  if (!z.uuid().safeParse(args.postId).success) return { ok: false, error: REPORT_TARGET_GONE };
  if (!(await consume({ ...REPORT_LIMIT, key: args.reporterId }))) return { ok: false, error: REPORTING_TOO_FAST };

  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<ReportResult> => {
    const [found] = await tx
      .select({ ownerId: post.ownerId, status: post.status, ownerDeletedAt: post.ownerDeletedAt })
      .from(post)
      .where(eq(post.id, args.postId))
      .for("update");
    if (!found || found.ownerDeletedAt !== null || (found.status !== "open" && found.status !== "reserved")) return { ok: false, error: REPORT_TARGET_GONE };
    if (found.ownerId === args.reporterId) return { ok: false, error: CANT_REPORT_SELF };

    const [saved] = await tx
      .insert(report)
      .values({ reporterId: args.reporterId, postId: args.postId, reason: parsed.reason, details: parsed.details })
      .onConflictDoNothing()
      .returning({ id: report.id });
    if (!saved) return { ok: false, error: ALREADY_REPORTED };

    const [counted] = await tx
      .select({ reporters: sql<number>`count(distinct ${report.reporterId})::int` })
      .from(report)
      .innerJoin(student, eq(student.id, report.reporterId))
      .where(and(eq(report.postId, args.postId), eq(report.status, "open"), eq(student.accountStatus, "active")));
    if (parsed.reason !== CHILD_SAFETY_REASON && counted.reporters < REPORT_HIDE_THRESHOLD) return { ok: true, hidden: false };

    const now = new Date();
    await tx.update(post).set({ status: "hidden", statusBeforeHidden: found.status, updatedAt: now }).where(eq(post.id, args.postId));
    recorded = await recordNotification(tx, {
      type: "post_hidden",
      recipientId: found.ownerId,
      postId: args.postId,
      onceKey: `hidden:${args.postId}:${now.getTime()}`,
    });
    return { ok: true, hidden: true };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}

/** A student reports another student, by handle. One open report each; nobody is suspended by reports alone. */
export async function reportStudent(args: { reporterId: string; handle: string; input: unknown }): Promise<ReportResult> {
  const parsed = parseInput(args.input);
  if (!parsed.ok) return parsed;

  if (!(await consume({ ...REPORT_LIMIT, key: args.reporterId }))) return { ok: false, error: REPORTING_TOO_FAST };
  const handle = args.handle.trim().toLowerCase().replace(/^@/, "");
  const db = getDb();
  const [target] = await db
    .select({ id: student.id, status: student.accountStatus })
    .from(student)
    .where(eq(student.handle, handle));
  if (!target || target.status !== "active") return { ok: false, error: REPORT_TARGET_GONE };
  if (target.id === args.reporterId) return { ok: false, error: CANT_REPORT_SELF };

  const [saved] = await db
    .insert(report)
    .values({ reporterId: args.reporterId, studentId: target.id, reason: parsed.reason, details: parsed.details })
    .onConflictDoNothing()
    .returning({ id: report.id });
  if (!saved) return { ok: false, error: ALREADY_REPORTED };
  return { ok: true, hidden: false };
}
