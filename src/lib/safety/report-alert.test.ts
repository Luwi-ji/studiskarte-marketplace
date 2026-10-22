import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitEvent } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { alertChildSafetyReport, alertNewIdCheck, alertNewReport, ID_CHECK_DIGEST, isChildSafetyInput, REPORT_DIGEST } from "@/lib/safety/report-alert";

const sendMail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/mail", () => ({ MailQuotaError: class MailQuotaError extends Error {}, sendMail }));

const db = getDb();
const clear = () => db.delete(rateLimitEvent).where(and(eq(rateLimitEvent.action, REPORT_DIGEST.action), eq(rateLimitEvent.key, REPORT_DIGEST.key)));

beforeEach(async () => {
  sendMail.mockClear();
  vi.stubEnv("MAIL_FROM", "support@test.example");
  await clear();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await clear();
  await getPool().end();
});

describe("ID check alert", () => {
  it("sends one email an hour however many checks arrive", async () => {
    await db.delete(rateLimitEvent).where(and(eq(rateLimitEvent.action, ID_CHECK_DIGEST.action), eq(rateLimitEvent.key, ID_CHECK_DIGEST.key)));
    await alertNewIdCheck();
    await alertNewIdCheck();
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: "ID check waiting" }));
    await db.delete(rateLimitEvent).where(and(eq(rateLimitEvent.action, ID_CHECK_DIGEST.action), eq(rateLimitEvent.key, ID_CHECK_DIGEST.key)));
  });
});

describe("report alerts", () => {
  it("sends one email an hour for ordinary reports, however many arrive", async () => {
    await alertNewReport("post");
    await alertNewReport("student");
    await alertNewReport("post");
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "support@test.example", subject: "New report waiting" }));
  });

  it("sends every child safety alert at once and does not use up the hourly digest", async () => {
    await alertChildSafetyReport("post");
    await alertChildSafetyReport("post");
    expect(sendMail).toHaveBeenCalledTimes(2);
    await alertNewReport("post");
    expect(sendMail).toHaveBeenCalledTimes(3);
  });

  it("does not throw when the mail fails: the report is already saved", async () => {
    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    await expect(alertNewReport("post")).resolves.toBeUndefined();
  });

  it("tells a child safety report from other input", () => {
    expect(isChildSafetyInput({ reason: "child_safety" })).toBe(true);
    expect(isChildSafetyInput({ reason: "spam" })).toBe(false);
    expect(isChildSafetyInput(null)).toBe(false);
    expect(isChildSafetyInput("child_safety")).toBe(false);
  });
});
