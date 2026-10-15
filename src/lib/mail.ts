import nodemailer, { type Transporter } from "nodemailer";
import { getDb } from "@/lib/db";
import { rateLimitEvent } from "@/db/schema";
import {
  MAIL_QUOTA_ACTION,
  MAIL_QUOTA_KEY,
  MAIL_QUOTA_STOP_AT,
  MAIL_QUOTA_WARN_AT,
  MAIL_QUOTA_WINDOW_SECONDS,
  countEvents,
} from "@/lib/rate-limit";

/** Gmail's daily recipient cap is nearly used up. Callers show "try again later". */
export class MailQuotaError extends Error {
  constructor() {
    super("daily mail quota reached");
    this.name = "MailQuotaError";
  }
}

let transporter: Transporter | undefined;

// MAIL_TRANSPORT=log is for local development only: messages are printed to
// the server log instead of sent, so codes can be read without using the Gmail
// quota. It is refused in production.
function isLogTransport(): boolean {
  if (process.env.MAIL_TRANSPORT !== "log") return false;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MAIL_TRANSPORT=log is not allowed in production");
  }
  return true;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;
  if (isLogTransport()) {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    return transporter;
  }
  const user = process.env.GMAIL_USER;
  const pass = process.env.APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_USER and APP_PASSWORD must be set to send mail");
  }
  transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return transporter;
}

/**
 * The only place mail leaves the system. Refuses once the 24-hour quota is
 * spent, and counts each message it sends.
 */
export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const sent = await countEvents(
    MAIL_QUOTA_ACTION,
    MAIL_QUOTA_KEY,
    MAIL_QUOTA_WINDOW_SECONDS,
  );
  if (sent >= MAIL_QUOTA_STOP_AT) {
    console.error(`mail quota reached: ${sent} sent in the last 24 hours`);
    throw new MailQuotaError();
  }
  if (sent >= MAIL_QUOTA_WARN_AT) {
    console.warn(`mail quota warning: ${sent} of 500 sent in the last 24 hours`);
  }

  await getTransporter().sendMail({
    from: `Studiskarte Marketplace <${process.env.GMAIL_USER ?? "dev@localhost"}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (isLogTransport()) console.log(`[mail:log] to=${message.to} ${message.text.replace(/\s+/g, " ")}`);

  await getDb()
    .insert(rateLimitEvent)
    .values({ action: MAIL_QUOTA_ACTION, key: MAIL_QUOTA_KEY });
}
