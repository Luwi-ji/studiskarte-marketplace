import { MailQuotaError } from "@/lib/mail";
import type { RateLimit } from "@/lib/rate-limit";
import { SUPPORT_EMAIL } from "./config";
import { buildSupportEmail, isSupportKind, parseSupportInput, type SupportSender } from "./send";

/** One student cannot fill the owner's inbox: this many messages an hour, and this many a day. */
export const SUPPORT_PER_HOUR = 5;
export const SUPPORT_PER_DAY = 10;

export const SUPPORT_TOO_FAST = "You have sent a few messages in the last hour. Wait a while before sending another. What you wrote is still here.";
export const SUPPORT_DAY_LIMIT = `You have reached today's limit of ${SUPPORT_PER_DAY} messages. Try again tomorrow. What you wrote is still here.`;
export const SUPPORT_NOT_SENT = "Could not send your message right now. Try again later. What you wrote is still here.";

export type SupportResult = { ok: true } | { ok: false; error: string; field?: string };

/** What sending needs from outside, so tests can stand in for the database and the mail provider. */
export type SupportDeps = {
  /** The student's own details from their account; null when the account is gone. */
  loadSender: (studentId: string) => Promise<SupportSender | null>;
  /** Records an attempt and says whether it fits the limit (rate-limit.ts `consume`). */
  consume: (limit: RateLimit) => Promise<boolean>;
  send: (message: { to: string; subject: string; text: string; replyTo?: string }) => Promise<void>;
  now: () => Date;
};

/**
 * Checks the form, applies the per-student limits, then emails the owner. Only a message that
 * the mail provider accepted gives `ok: true`; every other outcome is an error with a reason.
 */
export async function sendSupportMessage(deps: SupportDeps, args: { studentId: string; kind: unknown; values: unknown }): Promise<SupportResult> {
  if (!isSupportKind(args.kind)) return { ok: false, error: "Something looks wrong with that form. Reload the page and try again." };
  const kind = args.kind;
  const parsed = parseSupportInput(kind, args.values);
  if (!parsed.ok) return parsed;

  // A hard refusal does not use up the day's allowance as well.
  if (!(await deps.consume({ action: "support_message_hour", key: args.studentId, max: SUPPORT_PER_HOUR, windowSeconds: 60 * 60 }))) {
    return { ok: false, error: SUPPORT_TOO_FAST };
  }
  if (!(await deps.consume({ action: "support_message_day", key: args.studentId, max: SUPPORT_PER_DAY, windowSeconds: 24 * 60 * 60 }))) {
    return { ok: false, error: SUPPORT_DAY_LIMIT };
  }

  const sender = await deps.loadSender(args.studentId);
  if (!sender) return { ok: false, error: SUPPORT_NOT_SENT };

  const email = buildSupportEmail({ kind, values: parsed.values, sender, at: deps.now() });
  try {
    await deps.send({ to: SUPPORT_EMAIL, ...email });
  } catch (error) {
    if (error instanceof MailQuotaError) console.error("support message not sent: mail quota reached");
    else console.error("sending a support message failed", error);
    return { ok: false, error: SUPPORT_NOT_SENT };
  }
  return { ok: true };
}
