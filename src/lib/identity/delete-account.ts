import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import {
  account,
  block,
  deal,
  follow,
  heart,
  image,
  notification,
  offer,
  post,
  postView,
  pushSubscription,
  rateLimitEvent,
  report,
  session,
  student,
  verification,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES, syncAvailability } from "@/lib/deals/capacity";
import { endActiveDeal } from "@/lib/deals/end";
import type { ObjectStore } from "@/lib/images/store";
import { offerKey, recordNotification, type AlertSink, type Recorded } from "@/lib/notifications/record";

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

export const DELETE_NOT_ALLOWED = "This account could not be deleted.";
export const DELETE_ADMIN = "An admin account can't be deleted here. Ask the owner to remove your admin access first.";
export const DELETE_CONFIRM = "Type your handle exactly to confirm.";

/** The kinds of emailed code Better Auth keeps under "<type>-otp-<email>". */
const OTP_TYPES = ["sign-in", "email-verification", "forget-password"];

/** What the account's name reads as everywhere it still appears (old messages, reservations, reviews). */
export const DELETED_NAME = "Deleted account";

/**
 * Deletes a student's account for good, in one transaction.
 *
 * Erased: the school email (the row keeps a random address no one can sign in
 * with), handle, display name, profile picture, calendar link, sessions, device
 * alerts, notifications, follows, hearts, blocks, view history and any sign-in
 * codes. The school stays: the row needs one.
 *
 * Their listings are withdrawn, their pending offers (and offers to them) are
 * closed, and every reservation still being arranged ends: cancelled, or
 * disputed for an admin when it is already secured (see endActiveDeal). The other
 * person is told. What stays, so nobody else's history changes: their messages,
 * photos, finished reservations and reviews, shown as "Deleted account" with no
 * handle. A thread with them becomes read-only for the other person.
 *
 * Final: the same address can sign up again, but as a new student.
 */
export async function deleteAccount(args: {
  studentId: string;
  confirmHandle: string;
  store: ObjectStore;
  alert?: AlertSink;
  now?: Date;
}): Promise<DeleteAccountResult> {
  const now = args.now ?? new Date();
  const told: (Recorded | null)[] = [];
  let avatarKeys: string[] = [];

  const result = await getDb().transaction(async (tx): Promise<DeleteAccountResult> => {
    const [me] = await tx
      .select({ status: student.accountStatus, isAdmin: student.isAdmin, handle: student.handle, email: student.email, schoolEmail: student.schoolEmail, avatarImageId: student.avatarImageId })
      .from(student)
      .where(eq(student.id, args.studentId))
      .for("update");
    if (!me || me.status !== "active" || !me.handle) return { ok: false, error: DELETE_NOT_ALLOWED };
    if (me.isAdmin) return { ok: false, error: DELETE_ADMIN };
    if (args.confirmHandle.trim().replace(/^@/, "").toLowerCase() !== me.handle) return { ok: false, error: DELETE_CONFIRM };

    // Lock every post this touches, in id order and before changing anything, as every other flow
    // locks the post first. A reservation or offer being accepted at this moment finishes before we
    // look, or finds the post withdrawn and is refused; two flows never wait on each other.
    const mine = or(eq(deal.ownerId, args.studentId), eq(deal.responderId, args.studentId));
    await tx
      .select({ id: post.id })
      .from(post)
      .where(
        or(
          eq(post.ownerId, args.studentId),
          inArray(post.id, tx.select({ id: deal.postId }).from(deal).where(and(mine, inArray(deal.status, [...ACTIVE_STATUSES])))),
          inArray(post.id, tx.select({ id: offer.postId }).from(offer).where(and(eq(offer.responderId, args.studentId), eq(offer.status, "pending")))),
        ),
      )
      .orderBy(asc(post.id))
      .for("update");

    // Reservations still being arranged, in post order so two deletions that meet on a post line up.
    const active = await tx
      .select({ id: deal.id, postId: deal.postId, postOwnerId: post.ownerId })
      .from(deal)
      .innerJoin(post, eq(post.id, deal.postId))
      .where(and(mine, inArray(deal.status, [...ACTIVE_STATUSES])))
      .orderBy(asc(deal.postId), asc(deal.id));
    for (const found of active) {
      told.push(...(await endActiveDeal(tx, found.id, now, args.studentId)));
      // Units on someone else's post go back; mine are withdrawn below.
      if (found.postOwnerId !== args.studentId) await syncAvailability(tx, found.postId, now);
    }

    // Offers to their listings are declined (those people are told); their own pending offers are withdrawn.
    const declined = await tx
      .update(offer)
      .set({ status: "declined", decidedAt: now })
      .where(and(eq(offer.status, "pending"), inArray(offer.postId, tx.select({ id: post.id }).from(post).where(eq(post.ownerId, args.studentId)))))
      .returning({ id: offer.id, postId: offer.postId, responderId: offer.responderId, conversationId: offer.conversationId });
    for (const o of declined) {
      told.push(await recordNotification(tx, { type: "offer_declined", recipientId: o.responderId, postId: o.postId, conversationId: o.conversationId, onceKey: offerKey(o.id, "declined") }));
    }
    await tx.update(offer).set({ status: "withdrawn", decidedAt: now }).where(and(eq(offer.status, "pending"), eq(offer.responderId, args.studentId)));

    // Their listings are withdrawn; any report on them is moot.
    const withdrawn = await tx
      .update(post)
      .set({ status: "withdrawn", statusBeforeHidden: null, updatedAt: now })
      .where(and(eq(post.ownerId, args.studentId), inArray(post.status, ["open", "reserved", "hidden"])))
      .returning({ id: post.id });
    const withdrawnIds = withdrawn.map((p) => p.id);
    if (withdrawnIds.length > 0) {
      await tx.update(report).set({ status: "dismissed", handledAt: now }).where(and(inArray(report.postId, withdrawnIds), eq(report.status, "open")));
    }
    await tx.update(report).set({ status: "dismissed", handledAt: now }).where(and(eq(report.studentId, args.studentId), eq(report.status, "open")));

    // Everything that ties the account to a person or a device.
    await tx.delete(session).where(eq(session.userId, args.studentId));
    await tx.delete(account).where(eq(account.userId, args.studentId));
    await tx.delete(pushSubscription).where(eq(pushSubscription.studentId, args.studentId));
    await tx.delete(notification).where(eq(notification.recipientId, args.studentId));
    await tx.delete(follow).where(or(eq(follow.followerId, args.studentId), eq(follow.followeeId, args.studentId)));
    await tx.delete(heart).where(eq(heart.studentId, args.studentId));
    await tx.delete(postView).where(eq(postView.viewerId, args.studentId));
    await tx.delete(block).where(or(eq(block.blockerId, args.studentId), eq(block.blockedId, args.studentId)));
    // Exact matches only: another address that merely ends the same way must not be touched.
    await tx
      .delete(verification)
      .where(inArray(verification.identifier, [...OTP_TYPES.map((type) => `${type}-otp-${me.email}`), `school-link:${args.studentId}`]));
    await tx.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, [me.email, ...(me.schoolEmail ? [me.schoolEmail] : []), args.studentId]));

    // The profile picture goes with the account; its files are removed once this is saved.
    if (me.avatarImageId) {
      const [avatar] = await tx.select({ key: image.key, thumbKey: image.thumbKey }).from(image).where(eq(image.id, me.avatarImageId));
      await tx.update(student).set({ avatarImageId: null }).where(eq(student.id, args.studentId));
      await tx.delete(image).where(eq(image.id, me.avatarImageId));
      if (avatar) avatarKeys = [avatar.key, avatar.thumbKey];
    }

    await tx
      .update(student)
      .set({
        accountStatus: "deleted",
        email: `deleted.${randomUUID()}@deleted.edu.ph`,
        // The school email is released and no school is kept: the row is a closed account, not a member.
        schoolEmail: null,
        schoolDomain: null,
        role: "visitor",
        emailVerified: false,
        name: DELETED_NAME,
        handle: null,
        handleChangedAt: null,
        image: null,
        calendarTokenHash: null,
        updatedAt: now,
      })
      .where(eq(student.id, args.studentId));
    return { ok: true };
  });

  if (!result.ok) return result;
  for (const notice of told) if (notice?.alert) args.alert?.(notice.id);
  // The account is already gone; a failed file cleanup only leaves an unused file.
  if (avatarKeys.length > 0) {
    await args.store.delete(avatarKeys).catch((error) => {
      console.error("could not remove a deleted account's profile picture", error);
    });
  }
  return result;
}
