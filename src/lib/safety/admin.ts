import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { deal, image, post, postPhoto, report, session, student } from "@/db/schema";
import { type DbTransaction, getDb } from "@/lib/db";
import { syncAvailability } from "@/lib/deals/capacity";
import { endActiveDeal } from "@/lib/deals/end";
import { recordNotification, type AlertSink, type Recorded } from "@/lib/notifications/record";
import { isDuplicatePost } from "@/lib/posts/create";

export type AdminResult = { ok: true } | { ok: false; error: string };

export const NOT_ADMIN = "You can't do that.";
const POST_NOT_FOUND = "That post could not be found.";
const NOT_HIDDEN = "This post is not hidden.";
const CANT_REMOVE = "Only an open, reserved or hidden post can be removed.";
const NOT_REPORTABLE = "Only an open or reserved post has reports to dismiss. Restore or remove a hidden one.";
const STUDENT_NOT_FOUND = "That student could not be found.";
const CANT_SUSPEND_SELF = "You can't suspend yourself.";
const CANT_SUSPEND_ADMIN = "An admin can't be suspended.";
const NOT_ACTIVE = "Only an active account can be suspended.";
const NOT_SUSPENDED = "This account is not suspended.";
const DUPLICATE_ON_RESTORE = "The owner already has an open post like this one. Remove this one instead.";

/** The admin flag is read from the database on every call; a session alone never grants it. */
async function checkAdmin(tx: DbTransaction, adminId: string): Promise<boolean> {
  const [row] = await tx.select({ isAdmin: student.isAdmin, status: student.accountStatus }).from(student).where(eq(student.id, adminId));
  return row?.isAdmin === true && row.status === "active";
}

/** Runs one admin action in a transaction after re-checking the flag; sends device alerts once it is saved. */
async function asAdmin(
  adminId: string,
  alert: AlertSink | undefined,
  run: (tx: DbTransaction, now: Date, told: (Recorded | null)[]) => Promise<AdminResult>,
): Promise<AdminResult> {
  const told: (Recorded | null)[] = [];
  const result = await getDb().transaction(async (tx): Promise<AdminResult> => {
    if (!(await checkAdmin(tx, adminId))) return { ok: false, error: NOT_ADMIN };
    return run(tx, new Date(), told);
  });
  if (result.ok) for (const notice of told) if (notice?.alert) alert?.(notice.id);
  return result;
}

/** Closes the open reports on a post with the admin's decision. */
async function closePostReports(tx: DbTransaction, adminId: string, postId: string, status: "dismissed" | "actioned", now: Date): Promise<void> {
  await tx
    .update(report)
    .set({ status, handledBy: adminId, handledAt: now })
    .where(and(eq(report.postId, postId), eq(report.status, "open")));
}

/** Closes the open reports about a student with the admin's decision. */
async function closeStudentReports(tx: DbTransaction, adminId: string, studentId: string, status: "dismissed" | "actioned", now: Date): Promise<void> {
  await tx
    .update(report)
    .set({ status, handledBy: adminId, handledAt: now })
    .where(and(eq(report.studentId, studentId), eq(report.status, "open")));
}

/**
 * A hidden post goes back to what it was before it was hidden (open when unknown).
 * Its open reports are dismissed, so three new ones are needed to hide it again,
 * and the owner is told.
 */
export async function restorePost(adminId: string, postId: string, alert?: AlertSink): Promise<AdminResult> {
  try {
    return await asAdmin(adminId, alert, async (tx, now, told) => {
      const [found] = await tx
        .select({ ownerId: post.ownerId, status: post.status, before: post.statusBeforeHidden })
        .from(post)
        .where(eq(post.id, postId))
        .for("update");
      if (!found) return { ok: false, error: POST_NOT_FOUND };
      if (found.status !== "hidden") return { ok: false, error: NOT_HIDDEN };
      await tx
        .update(post)
        .set({ status: found.before ?? "open", statusBeforeHidden: null, updatedAt: now })
        .where(eq(post.id, postId));
      // Deals may have ended while it was hidden; bring a restored post in line with them.
      await syncAvailability(tx, postId, now);
      await closePostReports(tx, adminId, postId, "dismissed", now);
      told.push(await recordNotification(tx, { type: "post_restored", recipientId: found.ownerId, postId, onceKey: `restored:${postId}:${now.getTime()}` }));
      return { ok: true };
    });
  } catch (error) {
    // The owner listed the same thing again while this one was hidden.
    if (isDuplicatePost(error)) return { ok: false, error: DUPLICATE_ON_RESTORE };
    throw error;
  }
}

/**
 * Takes a post down for good. Its open reports are actioned, every active
 * reservation on it is ended by the system (see endActiveDeal), and the
 * owner is told.
 */
export async function removePost(adminId: string, postId: string, alert?: AlertSink): Promise<AdminResult> {
  return asAdmin(adminId, alert, async (tx, now, told) => {
    const [found] = await tx.select({ ownerId: post.ownerId, status: post.status }).from(post).where(eq(post.id, postId)).for("update");
    if (!found) return { ok: false, error: POST_NOT_FOUND };
    if (found.status !== "open" && found.status !== "reserved" && found.status !== "hidden") return { ok: false, error: CANT_REMOVE };

    const active = await tx
      .select({ id: deal.id })
      .from(deal)
      .where(and(eq(deal.postId, postId), inArray(deal.status, ["agreed", "scheduled"])));
    for (const { id } of active) told.push(...(await endActiveDeal(tx, id, now)));

    await tx.update(post).set({ status: "removed", statusBeforeHidden: null, updatedAt: now }).where(eq(post.id, postId));
    await closePostReports(tx, adminId, postId, "actioned", now);
    told.push(await recordNotification(tx, { type: "post_removed", recipientId: found.ownerId, postId, onceKey: `removed:${postId}:${now.getTime()}` }));
    return { ok: true };
  });
}

/** The reports on an open or reserved post were not a problem: they are dismissed and the post stays. */
export async function dismissPostReports(adminId: string, postId: string): Promise<AdminResult> {
  return asAdmin(adminId, undefined, async (tx, now) => {
    const [found] = await tx.select({ status: post.status }).from(post).where(eq(post.id, postId)).for("update");
    if (!found) return { ok: false, error: POST_NOT_FOUND };
    if (found.status !== "open" && found.status !== "reserved") return { ok: false, error: NOT_REPORTABLE };
    await closePostReports(tx, adminId, postId, "dismissed", now);
    return { ok: true };
  });
}

/** The reports about a student were not a problem: they are dismissed. */
export async function dismissStudentReports(adminId: string, studentId: string): Promise<AdminResult> {
  return asAdmin(adminId, undefined, async (tx, now) => {
    const [found] = await tx.select({ id: student.id }).from(student).where(eq(student.id, studentId)).for("update");
    if (!found) return { ok: false, error: STUDENT_NOT_FOUND };
    await closeStudentReports(tx, adminId, studentId, "dismissed", now);
    return { ok: true };
  });
}

/**
 * Suspends an active student: they cannot sign in, every session of theirs ends
 * and their open reports are actioned. Only an admin does this, never reports
 * alone, and never to themselves or another admin.
 */
export async function suspendStudent(adminId: string, studentId: string): Promise<AdminResult> {
  return asAdmin(adminId, undefined, async (tx, now) => {
    if (studentId === adminId) return { ok: false, error: CANT_SUSPEND_SELF };
    const [found] = await tx
      .select({ status: student.accountStatus, isAdmin: student.isAdmin })
      .from(student)
      .where(eq(student.id, studentId))
      .for("update");
    if (!found) return { ok: false, error: STUDENT_NOT_FOUND };
    if (found.isAdmin) return { ok: false, error: CANT_SUSPEND_ADMIN };
    if (found.status !== "active") return { ok: false, error: NOT_ACTIVE };
    await tx.update(student).set({ accountStatus: "suspended", updatedAt: now }).where(eq(student.id, studentId));
    await tx.delete(session).where(eq(session.userId, studentId));
    await closeStudentReports(tx, adminId, studentId, "actioned", now);
    return { ok: true };
  });
}

/** A suspended student gets their account back. */
export async function restoreStudent(adminId: string, studentId: string): Promise<AdminResult> {
  return asAdmin(adminId, undefined, async (tx, now) => {
    const [found] = await tx.select({ status: student.accountStatus }).from(student).where(eq(student.id, studentId)).for("update");
    if (!found) return { ok: false, error: STUDENT_NOT_FOUND };
    if (found.status !== "suspended") return { ok: false, error: NOT_SUSPENDED };
    await tx.update(student).set({ accountStatus: "active", updatedAt: now }).where(eq(student.id, studentId));
    return { ok: true };
  });
}

export type ReportLine = { reason: string; details: string | null; createdAt: Date };
export type QueuePost = {
  id: string;
  title: string;
  status: string;
  statusBeforeHidden: string | null;
  ownerId: string;
  ownerHandle: string | null;
  ownerName: string;
  coverThumbKey: string | null;
  reporterCount: number;
  reports: ReportLine[];
};
export type QueueStudent = { id: string; handle: string | null; displayName: string; accountStatus: string; reporterCount: number; reports: ReportLine[] };
export type SuspendedStudent = { id: string; handle: string | null; displayName: string };
export type AdminQueue = { posts: QueuePost[]; students: QueueStudent[]; suspended: SuspendedStudent[] };

const reporters = sql<number>`count(distinct ${report.reporterId})::int`;
/** Child safety reports come before everything else (child safety standards: highest priority). */
const childSafetyFirst = sql`bool_or(${report.reason} = 'child_safety') desc`;

/** Open reports grouped by line, oldest first, per target id. */
function groupLines(rows: { target: string | null; reason: string; details: string | null; createdAt: Date }[]): Map<string, ReportLine[]> {
  const lines = new Map<string, ReportLine[]>();
  for (const row of rows) {
    if (!row.target) continue;
    const list = lines.get(row.target) ?? [];
    list.push({ reason: row.reason, details: row.details, createdAt: row.createdAt });
    lines.set(row.target, list);
  }
  return lines;
}

/**
 * What the admin has to look at: posts with open reports (child safety first, then hidden, then the most
 * reporters, then the oldest), students with open reports, and suspended students.
 * Reporters are counted once however many times they reported. No email is read.
 */
export async function listAdminQueue(): Promise<AdminQueue> {
  const db = getDb();
  const posts = await db
    .select({
      id: post.id,
      title: post.title,
      status: post.status,
      statusBeforeHidden: post.statusBeforeHidden,
      ownerId: post.ownerId,
      ownerHandle: student.handle,
      ownerName: student.name,
      coverThumbKey: image.thumbKey,
      reporterCount: reporters,
    })
    .from(report)
    .innerJoin(post, eq(post.id, report.postId))
    .innerJoin(student, eq(student.id, post.ownerId))
    .leftJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .leftJoin(image, eq(image.id, postPhoto.imageId))
    .where(eq(report.status, "open"))
    .groupBy(post.id, student.id, image.id)
    .orderBy(childSafetyFirst, sql`(${post.status} = 'hidden') desc`, desc(reporters), asc(sql`min(${report.createdAt})`));
  const postLines = posts.length
    ? groupLines(
        await db
          .select({ target: report.postId, reason: report.reason, details: report.details, createdAt: report.createdAt })
          .from(report)
          .where(and(eq(report.status, "open"), inArray(report.postId, posts.map((p) => p.id))))
          .orderBy(asc(report.createdAt)),
      )
    : new Map<string, ReportLine[]>();

  const students = await db
    .select({
      id: student.id,
      handle: student.handle,
      displayName: student.name,
      accountStatus: student.accountStatus,
      reporterCount: reporters,
    })
    .from(report)
    .innerJoin(student, eq(student.id, report.studentId))
    .where(eq(report.status, "open"))
    .groupBy(student.id)
    .orderBy(childSafetyFirst, desc(reporters), asc(sql`min(${report.createdAt})`));
  const studentLines = students.length
    ? groupLines(
        await db
          .select({ target: report.studentId, reason: report.reason, details: report.details, createdAt: report.createdAt })
          .from(report)
          .where(and(eq(report.status, "open"), inArray(report.studentId, students.map((s) => s.id))))
          .orderBy(asc(report.createdAt)),
      )
    : new Map<string, ReportLine[]>();

  const suspended = await db
    .select({ id: student.id, handle: student.handle, displayName: student.name })
    .from(student)
    .where(eq(student.accountStatus, "suspended"))
    .orderBy(asc(student.name), asc(student.id));

  return {
    posts: posts.map((p) => ({ ...p, reports: postLines.get(p.id) ?? [] })),
    students: students.map((s) => ({ ...s, reports: studentLines.get(s.id) ?? [] })),
    suspended,
  };
}
