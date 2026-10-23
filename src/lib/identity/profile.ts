import { and, count, eq, isNull, lte, or, sql } from "drizzle-orm";
import { follow, image, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  checkDisplayName,
  checkHandle,
  HANDLE_CHANGE_DAYS,
  HANDLE_PROBLEM_MESSAGE,
  nextHandleChangeAt,
} from "@/lib/identity/names";
import type { ObjectStore } from "@/lib/images/store";
import { NO_SCHOOL_LABEL, type SchoolRole } from "@/lib/identity/roles";
import { discardImage, storeImage } from "@/lib/images/upload";
import { currentLegal } from "@/lib/legal/documents";
import { AGE_REQUIRED } from "@/lib/identity/age";
import { idCheckIsCurrent } from "@/lib/verification/config";
import { isBlockedEitherWay } from "@/lib/safety/block";
import { countFollowers, countFollowing } from "@/lib/social/follow";

/** What a student sees about themselves. Never includes the school email. `school` reads "Visitor" when there is no school email. */
export type OwnProfile = {
  handle: string | null;
  displayName: string;
  school: string;
  avatarKey: string | null;
  avatarThumbKey: string | null;
  nextHandleChangeAt: Date | null;
};

export async function getOwnProfile(studentId: string, now = new Date()): Promise<OwnProfile | null> {
  const [row] = await getDb()
    .select({
      handle: student.handle,
      displayName: student.name,
      schoolDomain: student.schoolDomain,
      schoolName: school.name,
      handleChangedAt: student.handleChangedAt,
      avatarKey: image.key,
      avatarThumbKey: image.thumbKey,
    })
    .from(student)
    .leftJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(eq(student.id, studentId));
  if (!row) return null;
  return {
    handle: row.handle,
    displayName: row.displayName,
    school: row.schoolName ?? row.schoolDomain ?? NO_SCHOOL_LABEL,
    avatarKey: row.avatarKey,
    avatarThumbKey: row.avatarThumbKey,
    nextHandleChangeAt: nextHandleChangeAt(row.handleChangedAt, now),
  };
}

/** What anyone signed in may see of a student. Never includes the school email. */
export type PublicProfile = {
  id: string;
  handle: string;
  displayName: string;
  school: string;
  avatarKey: string | null;
  /** How many active, visible people follow this student. */
  followerCount: number;
  /** How many people the student follows. Set only on the viewer's own profile; `null` for everyone else, whose following is never shown. */
  followingCount: number | null;
  isSelf: boolean;
  /** The owner checked a school ID and the check has not lapsed. */
  idChecked: boolean;
  /** Whether the viewer follows this student. */
  isFollowing: boolean;
};

/**
 * A student's public profile by handle (case-insensitive), or null when there
 * is no such student, or they have not finished sign-up, or they are suspended
 * or deleted, or the viewer and they have blocked each other (either way).
 */
export async function getPublicProfile(viewerId: string, rawHandle: string): Promise<PublicProfile | null> {
  const db = getDb();
  const handle = rawHandle.trim().replace(/^@/, "").toLowerCase();
  const [row] = await db
    .select({
      id: student.id,
      handle: student.handle,
      displayName: student.name,
      schoolName: school.name,
      schoolDomain: school.domain,
      avatarKey: image.key,
      idCheckedAt: student.idCheckedAt,
      idCheckExpiresAt: student.idCheckExpiresAt,
    })
    .from(student)
    .leftJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(and(eq(student.handle, handle), eq(student.accountStatus, "active")));
  if (!row?.handle) return null;
  if (row.id !== viewerId && (await isBlockedEitherWay(viewerId, row.id))) return null;

  const followerCount = await countFollowers(viewerId, row.id);
  const [mine] = await db
    .select({ n: count() })
    .from(follow)
    .where(and(eq(follow.followerId, viewerId), eq(follow.followeeId, row.id)));
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.displayName,
    school: row.schoolName ?? row.schoolDomain ?? NO_SCHOOL_LABEL,
    avatarKey: row.avatarKey,
    followerCount,
    followingCount: row.id === viewerId ? await countFollowing(viewerId, row.id) : null,
    isSelf: row.id === viewerId,
    idChecked: idCheckIsCurrent(row.idCheckedAt, row.idCheckExpiresAt),
    isFollowing: mine.n > 0,
  };
}

export type ProfileResult = { ok: true } | { ok: false; field: "handle" | "displayName" | "terms" | "age"; message: string };

const HANDLE_TAKEN: ProfileResult = { ok: false, field: "handle", message: "That handle is taken. Choose another." };

// Drizzle wraps the Postgres error in `cause`; narrow it instead of assuming its shape.
function isHandleTaken(error: unknown): boolean {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== "object") return false;
  const cause = error.cause;
  return (
    "code" in cause && cause.code === "23505" && "constraint" in cause && cause.constraint === "student_handle_unique"
  );
}

/**
 * Finishes sign-up: the first handle and display name, and, when the legal documents exist,
 * the acceptance of the version the student was shown and the confirmation of meeting the minimum age.
 * Only works once.
 */
export async function completeSignUp(
  studentId: string,
  input: { handle: string; displayName: string; role?: SchoolRole | null; acceptedTermsVersion?: string | null; ageConfirmed?: boolean },
  now = new Date(),
): Promise<ProfileResult> {
  const handle = checkHandle(input.handle);
  if (!handle.ok) return { ok: false, field: "handle", message: HANDLE_PROBLEM_MESSAGE[handle.problem] };
  const name = checkDisplayName(input.displayName);
  if (!name.ok) return { ok: false, field: "displayName", message: name.message };
  const legal = currentLegal();
  if (legal && input.acceptedTermsVersion !== legal.version) {
    return { ok: false, field: "terms", message: "Accept the Terms of Service and Privacy Policy to continue." };
  }
  if (legal && !input.ageConfirmed) return { ok: false, field: "age", message: AGE_REQUIRED };

  try {
    // The first choice does not start the 30-day clock: handle_changed_at stays null.
    const updated = await getDb()
      .update(student)
      .set({
        handle: handle.handle,
        name: name.name,
        // Someone with a school email says which kind of member they are; a visitor stays one.
        ...(input.role ? { role: sql`case when ${student.schoolEmail} is null then ${student.role} else ${input.role} end` } : {}),
        updatedAt: now,
        ...(legal ? { termsVersion: legal.version, termsAcceptedAt: now, ageConfirmedAt: now } : {}),
      })
      .where(and(eq(student.id, studentId), isNull(student.handle)))
      .returning({ id: student.id });
    if (updated.length === 0) return { ok: false, field: "handle", message: "Your sign-up is already complete." };
    return { ok: true };
  } catch (error) {
    if (isHandleTaken(error)) return HANDLE_TAKEN;
    throw error;
  }
}

export async function changeDisplayName(studentId: string, raw: string): Promise<ProfileResult> {
  const name = checkDisplayName(raw);
  if (!name.ok) return { ok: false, field: "displayName", message: name.message };
  await getDb().update(student).set({ name: name.name, updatedAt: new Date() }).where(and(eq(student.id, studentId), eq(student.accountStatus, "active")));
  return { ok: true };
}

/** Changes the handle, at most once every 30 days. */
export async function changeHandle(studentId: string, raw: string, now = new Date()): Promise<ProfileResult> {
  const handle = checkHandle(raw);
  if (!handle.ok) return { ok: false, field: "handle", message: HANDLE_PROBLEM_MESSAGE[handle.problem] };

  const db = getDb();
  const [current] = await db
    .select({ handle: student.handle, changedAt: student.handleChangedAt })
    .from(student)
    .where(eq(student.id, studentId));
  if (!current?.handle) return { ok: false, field: "handle", message: "Finish sign-up first." };
  if (current.handle === handle.handle) return { ok: true };

  const allowedAt = nextHandleChangeAt(current.changedAt, now);
  if (allowedAt) return tooSoon(allowedAt);

  try {
    // The date condition is repeated in the UPDATE so two changes sent at the
    // same moment cannot both pass.
    const cutoff = new Date(now.getTime() - HANDLE_CHANGE_DAYS * 24 * 60 * 60 * 1000);
    const updated = await db
      .update(student)
      .set({ handle: handle.handle, handleChangedAt: now, updatedAt: now })
      .where(
        and(
          eq(student.id, studentId),
          eq(student.accountStatus, "active"),
          or(isNull(student.handleChangedAt), lte(student.handleChangedAt, cutoff)),
        ),
      )
      .returning({ id: student.id });
    if (updated.length === 0) return tooSoon(null);
    return { ok: true };
  } catch (error) {
    if (isHandleTaken(error)) return HANDLE_TAKEN;
    throw error;
  }
}

function tooSoon(allowedAt: Date | null): ProfileResult {
  const when = allowedAt
    ? ` You can change it again on ${allowedAt.toLocaleDateString("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" })}.`
    : "";
  return { ok: false, field: "handle", message: `You can change your handle once every ${HANDLE_CHANGE_DAYS} days.${when}` };
}

/** Stores a new profile picture and removes the previous one. */
export async function changeAvatar(args: { studentId: string; bytes: Buffer; store: ObjectStore }): Promise<void> {
  const stored = await storeImage({ ownerId: args.studentId, bytes: args.bytes, purpose: "avatar", store: args.store });
  const db = getDb();
  let previous: { id: string; key: string; thumbKey: string } | undefined;
  let closed = false;
  try {
    previous = await db.transaction(async (tx) => {
      // Lock the student first: a picture must not be added to an account that was just deleted.
      const [me] = await tx.select({ status: student.accountStatus }).from(student).where(eq(student.id, args.studentId)).for("update");
      if (me?.status !== "active") {
        closed = true;
        return undefined;
      }
      const [old] = await tx
        .select({ id: image.id, key: image.key, thumbKey: image.thumbKey })
        .from(student)
        .innerJoin(image, eq(image.id, student.avatarImageId))
        .where(eq(student.id, args.studentId));
      await tx
        .update(student)
        .set({ avatarImageId: stored.id, updatedAt: sql`now()` })
        .where(eq(student.id, args.studentId));
      return old;
    });
  } catch (error) {
    await discardImage(stored, args.store).catch((cleanupError) => {
      console.error("could not remove a new profile picture after a failed save", cleanupError);
    });
    throw error;
  }
  if (closed) {
    // The account was deleted or suspended meanwhile: the new picture is not kept.
    await discardImage(stored, args.store).catch((error) => {
      console.error("could not remove a picture sent for a closed account", error);
    });
    return;
  }
  if (previous) {
    // The new picture is already saved; a failed cleanup only leaves an unused file.
    await discardImage({ id: previous.id, keys: [previous.key, previous.thumbKey] }, args.store).catch((error) => {
      console.error("could not remove the previous profile picture", error);
    });
  }
}
