import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { image, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  checkDisplayName,
  checkHandle,
  HANDLE_CHANGE_DAYS,
  HANDLE_PROBLEM_MESSAGE,
  nextHandleChangeAt,
} from "@/lib/identity/names";
import type { ObjectStore } from "@/lib/images/store";
import { discardImage, storeImage } from "@/lib/images/upload";

/** What a student sees about themselves. Never includes the school email. */
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
    .innerJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(eq(student.id, studentId));
  if (!row) return null;
  return {
    handle: row.handle,
    displayName: row.displayName,
    school: row.schoolName ?? row.schoolDomain,
    avatarKey: row.avatarKey,
    avatarThumbKey: row.avatarThumbKey,
    nextHandleChangeAt: nextHandleChangeAt(row.handleChangedAt, now),
  };
}

export type ProfileResult = { ok: true } | { ok: false; field: "handle" | "displayName"; message: string };

const HANDLE_TAKEN: ProfileResult = { ok: false, field: "handle", message: "That handle is taken. Choose another." };

// Drizzle wraps the Postgres error in `cause`; narrow it instead of assuming its shape.
function isHandleTaken(error: unknown): boolean {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== "object") return false;
  const cause = error.cause;
  return (
    "code" in cause && cause.code === "23505" && "constraint" in cause && cause.constraint === "student_handle_unique"
  );
}

/** Finishes sign-up: the first handle and display name. Only works once. */
export async function completeSignUp(
  studentId: string,
  input: { handle: string; displayName: string },
): Promise<ProfileResult> {
  const handle = checkHandle(input.handle);
  if (!handle.ok) return { ok: false, field: "handle", message: HANDLE_PROBLEM_MESSAGE[handle.problem] };
  const name = checkDisplayName(input.displayName);
  if (!name.ok) return { ok: false, field: "displayName", message: name.message };

  try {
    // The first choice does not start the 30-day clock: handle_changed_at stays null.
    const updated = await getDb()
      .update(student)
      .set({ handle: handle.handle, name: name.name, updatedAt: new Date() })
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
  await getDb().update(student).set({ name: name.name, updatedAt: new Date() }).where(eq(student.id, studentId));
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
  try {
    previous = await db.transaction(async (tx) => {
      const [old] = await tx
        .select({ id: image.id, key: image.key, thumbKey: image.thumbKey })
        .from(student)
        .innerJoin(image, eq(image.id, student.avatarImageId))
        .where(eq(student.id, args.studentId))
        .for("update", { of: student });
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
  if (previous) {
    // The new picture is already saved; a failed cleanup only leaves an unused file.
    await discardImage({ id: previous.id, keys: [previous.key, previous.thumbKey] }, args.store).catch((error) => {
      console.error("could not remove the previous profile picture", error);
    });
  }
}
