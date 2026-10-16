import { and, eq, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { conversation, conversationListing, image, message, messageImage, post, student } from "@/db/schema";
import { getDb, type DbTransaction } from "@/lib/db";
import { recordNotification, type AlertSink, type Recorded } from "@/lib/notifications/record";
import { consume } from "@/lib/rate-limit";
import { listingClosedReason, MESSAGES_PER_MINUTE, orderedPair, parseMessage, readOnlyReason, type MessageData } from "@/lib/messaging/rules";

export type SendResult = { ok: true; conversationId: string } | { ok: false; error: string };

const TOO_FAST: SendResult = { ok: false, error: "You are sending messages too fast. Wait a moment and try again." };
const NOT_FOUND: SendResult = { ok: false, error: "That conversation could not be found." };
const PHOTO_MISSING: SendResult = { ok: false, error: "A photo is missing. Add it again." };

/** Thrown inside the transaction, so nothing from the refused message is kept. */
export class PhotoMissingError extends Error {}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && typeof error.cause === "object" && error.cause !== null && "code" in error.cause && error.cause.code === "23505";
}

/**
 * Writes the message and its pictures, moves the conversation to the top of
 * the inbox, and marks everything up to it as read for the sender. The
 * pictures must be the sender's own, uploaded for messages, and not yet used.
 * `postId` makes it a listing card (an offer's card carries its listing too).
 */
export async function writeMessage(
  tx: DbTransaction,
  args: { conversationId: string; senderId: string; data: MessageData; offerId?: string; postId?: string },
): Promise<boolean> {
  const { conversationId, senderId, data } = args;
  if (data.imageIds.length > 0) {
    const usable = await tx
      .select({ id: image.id })
      .from(image)
      .where(
        and(
          eq(image.ownerId, senderId),
          eq(image.purpose, "message_photo"),
          notExists(tx.select({ one: messageImage.imageId }).from(messageImage).where(eq(messageImage.imageId, image.id))),
        ),
      );
    const usableIds = new Set(usable.map((row) => row.id));
    if (!data.imageIds.every((id) => usableIds.has(id))) return false;
  }

  const [sent] = await tx
    .insert(message)
    .values({ conversationId, senderId, body: data.body, offerId: args.offerId ?? null, postId: args.postId ?? null })
    .returning({ id: message.id, createdAt: message.createdAt });
  if (data.imageIds.length > 0) {
    await tx.insert(messageImage).values(data.imageIds.map((imageId, position) => ({ messageId: sent.id, imageId, position })));
  }
  await tx
    .update(conversation)
    .set({
      lastMessageAt: sent.createdAt,
      aReadUpTo: sql`case when ${conversation.participantA} = ${senderId} then ${sent.id}::bigint else ${conversation.aReadUpTo} end`,
      bReadUpTo: sql`case when ${conversation.participantB} = ${senderId} then ${sent.id}::bigint else ${conversation.bReadUpTo} end`,
    })
    .where(eq(conversation.id, conversationId));
  return true;
}

/**
 * The one conversation between the post's owner and another student, created
 * if there is none, with the post added to its listings. Two at once make one.
 */
export async function getOrCreateConversation(tx: DbTransaction, args: { postId: string; ownerId: string; otherId: string }): Promise<string> {
  const { a, b } = orderedPair(args.ownerId, args.otherId);
  const [created] = await tx.insert(conversation).values({ participantA: a, participantB: b }).onConflictDoNothing().returning({ id: conversation.id });
  let id = created?.id;
  if (!id) {
    const [existing] = await tx
      .select({ id: conversation.id })
      .from(conversation)
      .where(and(eq(conversation.participantA, a), eq(conversation.participantB, b)));
    id = existing.id;
  }
  await tx.insert(conversationListing).values({ conversationId: id, postId: args.postId }).onConflictDoNothing();
  return id;
}

/**
 * Sends a message about a listing: the listing's card with the text and
 * pictures, in the conversation between the sender and the owner (created if
 * this is their first). Refused for your own post, and for a post that is not
 * open or reserved by the time it is written.
 */
export async function startConversation(args: { senderId: string; postId: string; input: unknown; alert?: AlertSink; now?: Date }): Promise<SendResult> {
  const parsed = parseMessage(args.input);
  if (!parsed.ok) return parsed;
  if (!(await consume({ action: "message", key: args.senderId, max: MESSAGES_PER_MINUTE, windowSeconds: 60 }))) return TOO_FAST;

  const owner = alias(student, "owner");
  let recorded = null as Recorded | null;
  try {
    const result = await getDb().transaction(async (tx): Promise<SendResult> => {
      // Share-lock the post: it cannot be withdrawn or expired between this check and the write.
      const [target] = await tx
        .select({ ownerId: post.ownerId, status: post.status, expiresAt: post.expiresAt, ownerStatus: owner.accountStatus })
        .from(post)
        .innerJoin(owner, eq(owner.id, post.ownerId))
        .where(eq(post.id, args.postId))
        .for("share", { of: post });
      const [me] = await tx.select({ status: student.accountStatus }).from(student).where(eq(student.id, args.senderId));
      if (!target || !me) return { ok: false, error: "That post could not be found." };
      if (target.ownerId === args.senderId) return { ok: false, error: "You can't message your own post." };
      const blocked = listingClosedReason({
        postStatus: target.status,
        postExpiresAt: target.expiresAt,
        ownerStatus: target.ownerStatus,
        responderStatus: me.status,
        now: args.now,
      });
      if (blocked) return { ok: false, error: blocked };

      const conversationId = await getOrCreateConversation(tx, { postId: args.postId, ownerId: target.ownerId, otherId: args.senderId });
      if (!(await writeMessage(tx, { conversationId, senderId: args.senderId, data: parsed.data, postId: args.postId }))) {
        throw new PhotoMissingError();
      }
      recorded = await recordNotification(tx, { type: "message", recipientId: target.ownerId, postId: args.postId, conversationId });
      return { ok: true, conversationId };
    });
    if (result.ok && recorded?.alert) args.alert?.(recorded.id);
    return result;
  } catch (error) {
    if (error instanceof PhotoMissingError || isUniqueViolation(error)) return PHOTO_MISSING;
    throw error;
  }
}

/**
 * Sends a message in a conversation the sender is part of. A stranger gets the
 * same "not found" as for a conversation that does not exist. Refused only
 * when either person's account is closed.
 */
export async function sendMessage(args: { senderId: string; conversationId: string; input: unknown; alert?: AlertSink; now?: Date }): Promise<SendResult> {
  const parsed = parseMessage(args.input);
  if (!parsed.ok) return parsed;
  if (!(await consume({ action: "message", key: args.senderId, max: MESSAGES_PER_MINUTE, windowSeconds: 60 }))) return TOO_FAST;

  const personA = alias(student, "person_a");
  const personB = alias(student, "person_b");
  let recorded = null as Recorded | null;
  try {
    const result = await getDb().transaction(async (tx): Promise<SendResult> => {
      const [found] = await tx
        .select({ aId: conversation.participantA, bId: conversation.participantB, aStatus: personA.accountStatus, bStatus: personB.accountStatus })
        .from(conversation)
        .innerJoin(personA, eq(personA.id, conversation.participantA))
        .innerJoin(personB, eq(personB.id, conversation.participantB))
        .where(eq(conversation.id, args.conversationId))
        .for("update", { of: conversation });
      if (!found || (found.aId !== args.senderId && found.bId !== args.senderId)) return NOT_FOUND;
      const blocked = readOnlyReason({ aStatus: found.aStatus, bStatus: found.bStatus });
      if (blocked) return { ok: false, error: blocked };
      if (!(await writeMessage(tx, { conversationId: args.conversationId, senderId: args.senderId, data: parsed.data }))) {
        throw new PhotoMissingError();
      }
      const recipientId = found.aId === args.senderId ? found.bId : found.aId;
      recorded = await recordNotification(tx, { type: "message", recipientId, postId: null, conversationId: args.conversationId });
      return { ok: true, conversationId: args.conversationId };
    });
    if (result.ok && recorded?.alert) args.alert?.(recorded.id);
    return result;
  } catch (error) {
    if (error instanceof PhotoMissingError || isUniqueViolation(error)) return PHOTO_MISSING;
    throw error;
  }
}
