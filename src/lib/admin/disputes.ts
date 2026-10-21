import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { adminAction, deal, dealReport, post, student } from "@/db/schema";
import { getDb } from "@/lib/db";

/** How many open deal problems and recent admin actions the moderation page lists. */
export const DISPUTES_LIMIT = 30;
export const RECENT_ACTIONS_LIMIT = 20;

export type DisputeReport = { reporterHandle: string | null; reason: string; details: string | null; createdAt: Date };
export type Dispute = {
  dealId: string;
  postId: string;
  postTitle: string;
  status: string;
  ownerHandle: string | null;
  responderHandle: string | null;
  reports: DisputeReport[];
};

/**
 * Reservations with a problem report that are still going or disputed (a completed or cancelled one is over).
 * Disputed first, then the one reported longest ago. Handles only: no email, no message text.
 */
export async function listDisputes(): Promise<Dispute[]> {
  const db = getDb();
  const owner = alias(student, "owner");
  const responder = alias(student, "responder");
  const deals = await db
    .select({
      dealId: deal.id,
      postId: post.id,
      postTitle: post.title,
      status: deal.status,
      ownerHandle: owner.handle,
      responderHandle: responder.handle,
    })
    .from(deal)
    .innerJoin(dealReport, eq(dealReport.dealId, deal.id))
    .innerJoin(post, eq(post.id, deal.postId))
    .innerJoin(owner, eq(owner.id, deal.ownerId))
    .innerJoin(responder, eq(responder.id, deal.responderId))
    .where(inArray(deal.status, ["agreed", "scheduled", "disputed"]))
    .groupBy(deal.id, post.id, owner.id, responder.id)
    .orderBy(sql`(${deal.status} = 'disputed') desc`, asc(sql`min(${dealReport.createdAt})`))
    .limit(DISPUTES_LIMIT);
  if (deals.length === 0) return [];

  const reporter = alias(student, "reporter");
  const lines = await db
    .select({ dealId: dealReport.dealId, reporterHandle: reporter.handle, reason: dealReport.reason, details: dealReport.details, createdAt: dealReport.createdAt })
    .from(dealReport)
    .innerJoin(reporter, eq(reporter.id, dealReport.reporterId))
    .where(inArray(dealReport.dealId, deals.map((d) => d.dealId)))
    .orderBy(asc(dealReport.createdAt));
  return deals.map((d) => ({
    ...d,
    reports: lines.filter((l) => l.dealId === d.dealId).map((l) => ({ reporterHandle: l.reporterHandle, reason: l.reason, details: l.details, createdAt: l.createdAt })),
  }));
}

export type RecentAction = { id: string; action: string; adminHandle: string | null; postId: string | null; targetHandle: string | null; reason: string | null; createdAt: Date };

/** The admin's own record, newest first. */
export async function listRecentActions(limit: number = RECENT_ACTIONS_LIMIT): Promise<RecentAction[]> {
  const target = alias(student, "target");
  const rows = await getDb()
    .select({
      id: adminAction.id,
      action: adminAction.action,
      adminHandle: student.handle,
      postId: adminAction.postId,
      targetHandle: target.handle,
      reason: adminAction.reason,
      createdAt: adminAction.createdAt,
    })
    .from(adminAction)
    .innerJoin(student, eq(student.id, adminAction.adminId))
    .leftJoin(target, eq(target.id, adminAction.studentId))
    .orderBy(desc(adminAction.createdAt))
    .limit(limit);
  return rows;
}

export const ACTION_LABEL: Record<string, string> = {
  restore_post: "Restored a post",
  remove_post: "Removed a post",
  dismiss_post_reports: "Dismissed reports on a post",
  dismiss_student_reports: "Dismissed reports on a student",
  suspend_student: "Suspended a student",
  restore_student: "Restored a student",
};
