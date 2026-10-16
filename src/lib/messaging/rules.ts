import { z } from "zod";

export const MESSAGE_MAX = 2000;
export const MESSAGE_PHOTOS_MAX = 4;
/** Messages one student may send per minute, across all conversations. */
export const MESSAGES_PER_MINUTE = 20;

const inputSchema = z.object({
  body: z.string().max(MESSAGE_MAX * 2).default(""),
  imageIds: z.array(z.uuid()).max(MESSAGE_PHOTOS_MAX).default([]),
});

export type MessageData = { body: string | null; imageIds: string[] };

export type ParsedMessage = { ok: true; data: MessageData } | { ok: false; error: string };

/** Checks what the browser sent: text up to 2000 characters, up to 4 photos, and at least one of them. */
export function parseMessage(input: unknown): ParsedMessage {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That message could not be sent. Check it and try again." };
  const body = parsed.data.body.trim();
  if (body.length > MESSAGE_MAX) {
    return { ok: false, error: `Messages can be up to ${MESSAGE_MAX.toLocaleString("en-PH")} characters.` };
  }
  if (new Set(parsed.data.imageIds).size !== parsed.data.imageIds.length) {
    return { ok: false, error: "A photo was added twice." };
  }
  if (body === "" && parsed.data.imageIds.length === 0) {
    return { ok: false, error: "Write a message or add a photo." };
  }
  return { ok: true, data: { body: body === "" ? null : body, imageIds: parsed.data.imageIds } };
}

export const CLOSED_POST = "This post is no longer available, so no new messages can be sent.";
export const CLOSED_ACCOUNT = "This conversation is closed.";

/**
 * Why a conversation takes no new messages, or null when it does. A post that
 * is closed, withdrawn, expired or hidden makes it read-only; relisting makes
 * it active again, because this is worked out from the post as it is now.
 * A suspended or deleted student on either side closes it too.
 */
export function readOnlyReason(args: {
  postStatus: string;
  postExpiresAt: Date;
  ownerStatus: string;
  responderStatus: string;
  now?: Date;
}): string | null {
  const now = args.now ?? new Date();
  if (args.ownerStatus !== "active" || args.responderStatus !== "active") return CLOSED_ACCOUNT;
  const live = args.postStatus === "reserved" || (args.postStatus === "open" && args.postExpiresAt.getTime() > now.getTime());
  return live ? null : CLOSED_POST;
}
