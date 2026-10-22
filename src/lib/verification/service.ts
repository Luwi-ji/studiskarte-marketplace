import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { idConsent, idImageView, idVerification, student } from "@/db/schema";
import { type DbTransaction, getDb } from "@/lib/db";
import { InvalidImageError, processImage } from "@/lib/images/process";
import type { ObjectStore } from "@/lib/images/store";
import { currentLegal } from "@/lib/legal/documents";
import { consume } from "@/lib/rate-limit";
import { CHECK_VALID_DAYS, type DocumentKind, DOCUMENT_KINDS, idCheckIsCurrent, MAX_REJECTED_CHECKS, OPEN_CHECK_KEEP_DAYS, VIEW_LINK_SECONDS, verificationEnabled } from "@/lib/verification/config";
import { ID_CONSENT_VERSION } from "@/lib/verification/consent";

const DAY = 86_400_000;

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const NOT_OPEN = "ID checks are not open yet.";
export const NOT_ADMIN = "You can't do that.";
const NEEDS_CONSENT = "Tick the box to agree before you continue.";
const NEEDS_SCHOOL_EMAIL = "Add your school email in Settings first. The ID check is for students, teachers, staff and alumni.";
const NEEDS_AGE = "Confirm your age first.";
const ALREADY_CHECKED = "Your ID is already checked.";
const TOO_MANY_REJECTED = "Your ID could not be approved after several tries. Write to support@studiskarte.com.";
const ALREADY_WAITING = "Your ID check is already waiting for the owner.";
const NO_OPEN_CHECK = "There is no ID check to add pictures to. Start again.";
const NEED_BOTH = "Add both pictures first: your ID and the photo of you holding it.";
const UPLOADS_PER_HOUR = { max: 12, windowSeconds: 60 * 60 };
const REASON_MAX = 300;

export type Slot = "document" | "holding";
const KEY_COLUMN = { document: "documentKey", holding: "holdingKey" } as const;

async function checkAdmin(tx: DbTransaction, adminId: string): Promise<boolean> {
  const [row] = await tx.select({ isAdmin: student.isAdmin, status: student.accountStatus }).from(student).where(eq(student.id, adminId));
  return row?.isAdmin === true && row.status === "active";
}

export type MyCheck = {
  /** The checks are open (private bucket set). */
  enabled: boolean;
  /** Has a current approved check. */
  checked: boolean;
  expiresAt: Date | null;
  /** The open check, if any. */
  open: null | { id: string; status: "draft" | "pending"; documentKind: DocumentKind; hasDocument: boolean; hasHolding: boolean };
  /** The last decision that went against the person, with the owner's reason. */
  lastRejection: { reason: string | null; at: Date } | null;
  rejectedCount: number;
  canAsk: boolean;
  /** Why they cannot ask now, for the screen. */
  cannotAskBecause: string | null;
};

/** What the ID check screen needs to know about this person. */
export async function getMyCheck(studentId: string, now: Date = new Date()): Promise<MyCheck> {
  const db = getDb();
  const [me] = await db
    .select({ role: student.role, schoolEmail: student.schoolEmail, ageConfirmedAt: student.ageConfirmedAt, checkedAt: student.idCheckedAt, expiresAt: student.idCheckExpiresAt })
    .from(student)
    .where(eq(student.id, studentId));
  const rows = await db.select().from(idVerification).where(eq(idVerification.studentId, studentId)).orderBy(desc(idVerification.createdAt));
  const open = rows.find((r) => r.status === "draft" || r.status === "pending");
  const rejected = rows.filter((r) => r.status === "rejected");
  const checked = me ? idCheckIsCurrent(me.checkedAt, me.expiresAt, now) : false;
  const enabled = verificationEnabled();
  let cannotAskBecause: string | null = null;
  if (!enabled) cannotAskBecause = NOT_OPEN;
  else if (!me || me.role === "visitor" || !me.schoolEmail) cannotAskBecause = NEEDS_SCHOOL_EMAIL;
  else if (!me.ageConfirmedAt) cannotAskBecause = NEEDS_AGE;
  else if (checked) cannotAskBecause = ALREADY_CHECKED;
  else if (rejected.length >= MAX_REJECTED_CHECKS) cannotAskBecause = TOO_MANY_REJECTED;
  else if (open?.status === "pending") cannotAskBecause = ALREADY_WAITING;
  return {
    enabled,
    checked,
    expiresAt: checked ? (me?.expiresAt ?? null) : null,
    open: open ? { id: open.id, status: open.status as "draft" | "pending", documentKind: open.documentKind as DocumentKind, hasDocument: open.documentKey !== null, hasHolding: open.holdingKey !== null } : null,
    lastRejection: rejected[0] ? { reason: rejected[0].reason, at: rejected[0].decidedAt ?? rejected[0].createdAt } : null,
    rejectedCount: rejected.length,
    canAsk: cannotAskBecause === null,
    cannotAskBecause,
  };
}

/**
 * The person agrees and starts a check. Records the consent (the exact text version and the policy version),
 * then opens a draft to add pictures to. Asking again while a draft is open returns the draft and records no second consent.
 */
export async function startCheck(args: { studentId: string; documentKind: unknown; consented: boolean; now?: Date }): Promise<Result<{ id: string }>> {
  if (!verificationEnabled()) return { ok: false, error: NOT_OPEN };
  if (!args.consented) return { ok: false, error: NEEDS_CONSENT };
  const kind = DOCUMENT_KINDS.find((k) => k === args.documentKind);
  if (!kind) return { ok: false, error: "Choose which document you will show." };
  const now = args.now ?? new Date();

  return getDb().transaction(async (tx): Promise<Result<{ id: string }>> => {
    const [me] = await tx
      .select({ status: student.accountStatus, role: student.role, schoolEmail: student.schoolEmail, ageConfirmedAt: student.ageConfirmedAt, checkedAt: student.idCheckedAt, expiresAt: student.idCheckExpiresAt })
      .from(student)
      .where(eq(student.id, args.studentId))
      .for("update");
    if (!me || me.status !== "active") return { ok: false, error: "Your account can't do that." };
    if (me.role === "visitor" || !me.schoolEmail) return { ok: false, error: NEEDS_SCHOOL_EMAIL };
    if (!me.ageConfirmedAt) return { ok: false, error: NEEDS_AGE };
    if (idCheckIsCurrent(me.checkedAt, me.expiresAt, now)) return { ok: false, error: ALREADY_CHECKED };

    const rows = await tx.select({ id: idVerification.id, status: idVerification.status }).from(idVerification).where(eq(idVerification.studentId, args.studentId));
    if (rows.filter((r) => r.status === "rejected").length >= MAX_REJECTED_CHECKS) return { ok: false, error: TOO_MANY_REJECTED };
    const open = rows.find((r) => r.status === "draft" || r.status === "pending");
    if (open?.status === "pending") return { ok: false, error: ALREADY_WAITING };
    if (open) return { ok: true, id: open.id };

    await tx.insert(idConsent).values({ studentId: args.studentId, event: "given", textVersion: ID_CONSENT_VERSION, policyVersion: currentLegal()?.version ?? null, createdAt: now });
    const [created] = await tx
      .insert(idVerification)
      .values({ studentId: args.studentId, documentKind: kind, claimedRole: me.role, createdAt: now })
      .returning({ id: idVerification.id });
    return { ok: true, id: created.id };
  });
}

/**
 * Stores one picture (the ID, or the photo of the person holding it) in the private bucket, re-encoded so location and
 * camera data are gone. Replaces an earlier picture in the same slot. Only the person's own open draft takes pictures.
 */
export async function addPicture(args: { studentId: string; slot: Slot; bytes: Buffer; store: ObjectStore }): Promise<Result> {
  if (!verificationEnabled()) return { ok: false, error: NOT_OPEN };
  if (!(await consume({ action: "id_upload", key: args.studentId, ...UPLOADS_PER_HOUR }))) return { ok: false, error: "Too many uploads. Try again later." };

  const db = getDb();
  const [draft] = await db
    .select({ id: idVerification.id })
    .from(idVerification)
    .where(and(eq(idVerification.studentId, args.studentId), eq(idVerification.status, "draft")));
  if (!draft) return { ok: false, error: NO_OPEN_CHECK };

  let main: Buffer;
  try {
    main = (await processImage(args.bytes, "photo")).main;
  } catch (error) {
    if (error instanceof InvalidImageError) return { ok: false, error: "Use a JPEG, PNG or WebP photo." };
    throw error;
  }
  const key = `id/${args.studentId}/${randomUUID()}.webp`;
  await args.store.put(key, main, "image/webp");

  const column = KEY_COLUMN[args.slot];
  const previous = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(idVerification).where(and(eq(idVerification.id, draft.id), eq(idVerification.status, "draft"))).for("update");
    if (!row) return { gone: true as const, key: null };
    await tx.update(idVerification).set({ [column]: key }).where(eq(idVerification.id, draft.id));
    return { gone: false as const, key: row[column] };
  });
  if (previous.gone) {
    await args.store.delete([key]);
    return { ok: false, error: NO_OPEN_CHECK };
  }
  if (previous.key) await args.store.delete([previous.key]);
  return { ok: true };
}

/** Sends a draft with both pictures to the owner. */
export async function submitCheck(studentId: string, now: Date = new Date()): Promise<Result> {
  if (!verificationEnabled()) return { ok: false, error: NOT_OPEN };
  const updated = await getDb()
    .update(idVerification)
    .set({ status: "pending", submittedAt: now })
    .where(and(eq(idVerification.studentId, studentId), eq(idVerification.status, "draft"), isNotNull(idVerification.documentKey), isNotNull(idVerification.holdingKey)))
    .returning({ id: idVerification.id });
  return updated.length === 1 ? { ok: true } : { ok: false, error: NEED_BOTH };
}

/**
 * The person takes their consent back: any open check is closed and its pictures deleted first, the badge is
 * removed, and the withdrawal is written down. Does nothing (and says so) if there was nothing to withdraw.
 */
export async function withdrawConsent(args: { studentId: string; store: ObjectStore; channel?: "settings" | "email"; now?: Date }): Promise<Result> {
  const now = args.now ?? new Date();
  const db = getDb();
  const open = await db
    .select({ id: idVerification.id, documentKey: idVerification.documentKey, holdingKey: idVerification.holdingKey })
    .from(idVerification)
    .where(and(eq(idVerification.studentId, args.studentId), inArray(idVerification.status, ["draft", "pending"])));
  const keys = open.flatMap((r) => [r.documentKey, r.holdingKey]).filter((k): k is string => k !== null);
  // Deleting first: if the bucket fails nothing is recorded and the person can try again.
  await args.store.delete(keys);

  return db.transaction(async (tx): Promise<Result> => {
    const [me] = await tx.select({ checkedAt: student.idCheckedAt }).from(student).where(eq(student.id, args.studentId)).for("update");
    if (!me) return { ok: false, error: "Your account can't do that." };
    const closed = await tx
      .update(idVerification)
      .set({ status: "withdrawn", documentKey: null, holdingKey: null })
      .where(and(eq(idVerification.studentId, args.studentId), inArray(idVerification.status, ["draft", "pending"])))
      .returning({ id: idVerification.id });
    if (closed.length === 0 && me.checkedAt === null) return { ok: false, error: "There is nothing to withdraw." };
    await tx.update(student).set({ idCheckedAt: null, idCheckExpiresAt: null, updatedAt: now }).where(eq(student.id, args.studentId));
    await tx.insert(idConsent).values({ studentId: args.studentId, event: "withdrawn", textVersion: ID_CONSENT_VERSION, policyVersion: currentLegal()?.version ?? null, channel: args.channel ?? "settings", createdAt: now });
    return { ok: true };
  });
}

export type PendingCheck = {
  id: string;
  studentId: string;
  handle: string | null;
  displayName: string;
  schoolDomain: string | null;
  claimedRole: string;
  documentKind: DocumentKind;
  submittedAt: Date;
  earlierRejections: number;
};

/** Checks waiting for the owner, oldest first. No email address is read. */
export async function listPendingChecks(): Promise<PendingCheck[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: idVerification.id,
      studentId: idVerification.studentId,
      handle: student.handle,
      displayName: student.name,
      schoolDomain: student.schoolDomain,
      claimedRole: idVerification.claimedRole,
      documentKind: idVerification.documentKind,
      submittedAt: idVerification.submittedAt,
    })
    .from(idVerification)
    .innerJoin(student, eq(student.id, idVerification.studentId))
    .where(eq(idVerification.status, "pending"))
    .orderBy(asc(idVerification.submittedAt));
  if (rows.length === 0) return [];
  const rejected = await db
    .select({ studentId: idVerification.studentId, n: count() })
    .from(idVerification)
    .where(and(eq(idVerification.status, "rejected"), inArray(idVerification.studentId, rows.map((r) => r.studentId))))
    .groupBy(idVerification.studentId);
  const rejectedBy = new Map(rejected.map((r) => [r.studentId, r.n]));
  return rows.map((r) => ({ ...r, documentKind: r.documentKind as DocumentKind, submittedAt: r.submittedAt ?? new Date(0), earlierRejections: rejectedBy.get(r.studentId) ?? 0 }));
}

/**
 * A short-lived link to one picture of a pending check, for the admin. The view is written down first; with no
 * record there is no link.
 */
export async function viewPicture(args: { adminId: string; verificationId: string; slot: Slot; store: ObjectStore }): Promise<Result<{ url: string }>> {
  const key = await getDb().transaction(async (tx): Promise<string | null> => {
    if (!(await checkAdmin(tx, args.adminId))) return null;
    const [row] = await tx.select().from(idVerification).where(and(eq(idVerification.id, args.verificationId), eq(idVerification.status, "pending")));
    const found = row?.[KEY_COLUMN[args.slot]] ?? null;
    if (!found) return null;
    await tx.insert(idImageView).values({ verificationId: args.verificationId, adminId: args.adminId, slot: args.slot });
    return found;
  });
  if (!key) return { ok: false, error: NOT_ADMIN };
  return { ok: true, url: await args.store.signedUrl(key, VIEW_LINK_SECONDS) };
}

/**
 * The owner decides a pending check. The pictures are deleted from the bucket first; if that fails nothing is decided.
 * Approving gives the person the "ID checked" badge for CHECK_VALID_DAYS and confirms that the ID shows they meet the minimum age.
 * Rejecting needs a reason, which the person sees.
 */
export async function decideCheck(args: { adminId: string; verificationId: string; decision: "approve" | "reject"; reason?: string; store: ObjectStore; now?: Date }): Promise<Result> {
  const now = args.now ?? new Date();
  const reason = (args.reason ?? "").trim();
  if (reason.length > REASON_MAX) return { ok: false, error: `Use at most ${REASON_MAX} characters for the reason.` };
  if (args.decision === "reject" && reason === "") return { ok: false, error: "Write a reason the person can read." };

  const db = getDb();
  const [before] = await db.select({ status: idVerification.status, documentKey: idVerification.documentKey, holdingKey: idVerification.holdingKey }).from(idVerification).where(eq(idVerification.id, args.verificationId));
  if (!before || before.status !== "pending") return { ok: false, error: "That check is not waiting for a decision." };
  const isAdmin = await db.transaction((tx) => checkAdmin(tx, args.adminId));
  if (!isAdmin) return { ok: false, error: NOT_ADMIN };

  await args.store.delete([before.documentKey, before.holdingKey].filter((k): k is string => k !== null));

  return db.transaction(async (tx): Promise<Result> => {
    const [row] = await tx.select().from(idVerification).where(eq(idVerification.id, args.verificationId)).for("update");
    if (!row || row.status !== "pending") return { ok: false, error: "That check is not waiting for a decision." };
    await tx
      .update(idVerification)
      .set({ status: args.decision === "approve" ? "approved" : "rejected", documentKey: null, holdingKey: null, decidedBy: args.adminId, decidedAt: now, reason: reason === "" ? null : reason })
      .where(eq(idVerification.id, args.verificationId));
    if (args.decision === "approve") {
      await tx
        .update(student)
        .set({ idCheckedAt: now, idCheckExpiresAt: new Date(now.getTime() + CHECK_VALID_DAYS * DAY), updatedAt: now })
        .where(eq(student.id, row.studentId));
    }
    return { ok: true };
  });
}

/**
 * Housekeeping, safe to run twice: closes checks left open for OPEN_CHECK_KEEP_DAYS and deletes their pictures,
 * and lets lapsed approvals go (badge off, check marked expired). Returns how many of each.
 */
export async function expireChecks(store: ObjectStore, now: Date = new Date()): Promise<{ closed: number; lapsed: number }> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - OPEN_CHECK_KEEP_DAYS * DAY);
  const stale = await db
    .select({ id: idVerification.id, documentKey: idVerification.documentKey, holdingKey: idVerification.holdingKey })
    .from(idVerification)
    .where(and(inArray(idVerification.status, ["draft", "pending"]), lt(sql`coalesce(${idVerification.submittedAt}, ${idVerification.createdAt})`, cutoff)));
  await store.delete(stale.flatMap((r) => [r.documentKey, r.holdingKey]).filter((k): k is string => k !== null));
  let closed = 0;
  if (stale.length > 0) {
    const done = await db
      .update(idVerification)
      .set({ status: "expired", documentKey: null, holdingKey: null })
      .where(and(inArray(idVerification.id, stale.map((r) => r.id)), inArray(idVerification.status, ["draft", "pending"])))
      .returning({ id: idVerification.id });
    closed = done.length;
  }

  const lapsedStudents = await db
    .update(student)
    .set({ idCheckedAt: null, idCheckExpiresAt: null, updatedAt: now })
    .where(and(isNotNull(student.idCheckExpiresAt), lt(student.idCheckExpiresAt, now)))
    .returning({ id: student.id });
  if (lapsedStudents.length > 0) {
    await db
      .update(idVerification)
      .set({ status: "expired" })
      .where(and(eq(idVerification.status, "approved"), inArray(idVerification.studentId, lapsedStudents.map((s) => s.id))));
  }
  return { closed, lapsed: lapsedStudents.length };
}

/**
 * Account deletion: closes any open check and deletes its pictures. The result rows and the consent record stay
 * (the privacy text says how long). Called before the account is erased.
 */
export async function deleteChecksOf(studentId: string, store: ObjectStore): Promise<void> {
  const db = getDb();
  const open = await db
    .select({ documentKey: idVerification.documentKey, holdingKey: idVerification.holdingKey })
    .from(idVerification)
    .where(and(eq(idVerification.studentId, studentId), inArray(idVerification.status, ["draft", "pending"])));
  await store.delete(open.flatMap((r) => [r.documentKey, r.holdingKey]).filter((k): k is string => k !== null));
  await db
    .update(idVerification)
    .set({ status: "withdrawn", documentKey: null, holdingKey: null })
    .where(and(eq(idVerification.studentId, studentId), inArray(idVerification.status, ["draft", "pending"])));
  await db.update(student).set({ idCheckedAt: null, idCheckExpiresAt: null }).where(eq(student.id, studentId));
}
