"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { markRead } from "@/lib/messaging/read";
import { sendMessage, startConversation, type SendResult } from "@/lib/messaging/send";
import { sendAlertAfterResponse } from "@/lib/notifications/push/schedule";

const idSchema = z.uuid();
const GONE: SendResult = { ok: false, error: "That conversation could not be found." };

// Inputs are typed as unknown: they come from the browser and are checked by
// parseMessage before anything is written.

/** Sends the first message about a post, creating the conversation. */
export async function startConversationAction(postId: unknown, input: unknown): Promise<SendResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(postId);
  if (!id.success) return { ok: false, error: "That post could not be found." };
  const result = await startConversation({ senderId: me.id, postId: id.data, input, alert: sendAlertAfterResponse });
  if (result.ok) refresh();
  return result;
}

export async function sendMessageAction(conversationId: unknown, input: unknown): Promise<SendResult> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(conversationId);
  if (!id.success) return GONE;
  const result = await sendMessage({ senderId: me.id, conversationId: id.data, input, alert: sendAlertAfterResponse });
  if (result.ok) refresh();
  return result;
}

/** Marks the conversation read for the signed-in student; refreshes the page only if something was unread. */
export async function markReadAction(conversationId: unknown): Promise<void> {
  const me = await requireActiveStudent();
  const id = idSchema.safeParse(conversationId);
  if (id.success && (await markRead(me.id, id.data))) refresh();
}
