import { MailQuotaError, sendMail } from "@/lib/mail";
import { consume } from "@/lib/rate-limit";
import { CHILD_SAFETY_REASON } from "@/lib/safety/report";

/** Whether a report input is a child safety report (the reason is checked again by reportPost/reportStudent). */
export function isChildSafetyInput(input: unknown): boolean {
  return typeof input === "object" && input !== null && "reason" in input && input.reason === CHILD_SAFETY_REASON;
}

/** At most one "new report" email an hour, so a burst of reports cannot use up the day's mail (sign-in codes share it). */
export const REPORT_DIGEST = { action: "report_alert", key: "owner", max: 1, windowSeconds: 60 * 60 };

/** At most one "ID check waiting" email an hour, for the same reason. */
export const ID_CHECK_DIGEST = { action: "id_check_alert", key: "owner", max: 1, windowSeconds: 60 * 60 };

/** Tells the owner an ID check was sent in. Same rules as alertNewReport: hourly at most, never throws. */
export async function alertNewIdCheck(): Promise<void> {
  const to = process.env.CHILD_SAFETY_ALERT_EMAIL || process.env.MAIL_FROM;
  if (!to) return;
  try {
    if (!(await consume(ID_CHECK_DIGEST))) return;
    await sendMail({ to, subject: "ID check waiting", text: `A member sent in an ID check. Pictures are deleted after 7 days if nobody decides. More checks in the next hour will not send another email.\n\n${process.env.BETTER_AUTH_URL ?? ""}/admin/verifications` });
  } catch (error) {
    if (error instanceof MailQuotaError) console.error("ID check alert not sent: mail quota reached");
    else console.error("ID check alert failed", error);
  }
}

/**
 * Tells the owner an ordinary report arrived (any reason except child safety, which has its own immediate alert).
 * Sent once an hour at most; the email only says where to look. Never throws: the report is already saved.
 */
export async function alertNewReport(target: "post" | "student"): Promise<void> {
  const to = process.env.CHILD_SAFETY_ALERT_EMAIL || process.env.MAIL_FROM;
  if (!to) return;
  try {
    if (!(await consume(REPORT_DIGEST))) return;
    await sendMail({ to, subject: "New report waiting", text: `A member reported a ${target}. Open the review queue when you can. More reports in the next hour will not send another email.\n\n${process.env.BETTER_AUTH_URL ?? ""}/admin/moderation` });
  } catch (error) {
    if (error instanceof MailQuotaError) console.error("report alert not sent: mail quota reached");
    else console.error("report alert failed", error);
  }
}

/**
 * Tells the owner a child safety report arrived, so it can be looked at within 24 hours (child safety
 * standards, RA 11930 Sec 9(a)(3)). Goes to CHILD_SAFETY_ALERT_EMAIL, or the support address (MAIL_FROM).
 * No names, no report text: only where to look. Never throws: the report is already saved.
 */
export async function alertChildSafetyReport(target: "post" | "student"): Promise<void> {
  const to = process.env.CHILD_SAFETY_ALERT_EMAIL || process.env.MAIL_FROM;
  if (!to) return;
  const base = process.env.BETTER_AUTH_URL ?? "";
  try {
    await sendMail({
      to,
      subject: "URGENT: child safety report",
      text: `A member reported a ${target} for child safety. Review it now and remove it if it is clear (target: within 24 hours).\n\n${base}/admin/moderation`,
    });
  } catch (error) {
    if (error instanceof MailQuotaError) console.error("child safety alert not sent: mail quota reached");
    else console.error("child safety alert failed", error);
  }
}
