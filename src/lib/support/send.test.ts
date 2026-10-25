import { describe, expect, it, vi, type Mock } from "vitest";
import { MailQuotaError } from "@/lib/mail";
import { SUPPORT_EMAIL } from "./config";
import { buildSupportEmail, cleanHeader, cleanText, emptyValues, manilaTime, MESSAGE_MAX, parseSupportInput, supportSubject, type SupportSender } from "./send";
import { sendSupportMessage, SUPPORT_DAY_LIMIT, SUPPORT_NOT_SENT, SUPPORT_TOO_FAST, type SupportDeps } from "./submit";

const sender: SupportSender = { handle: "juan", displayName: "Juan Dela Cruz", role: "student", email: "juan@example.com" };
const at = new Date("2026-10-25T07:04:05.000Z");

/** Deps that work, with `send` as a spy; each test overrides what it wants to break. */
function deps(over: Partial<SupportDeps> = {}): SupportDeps & { send: Mock<SupportDeps["send"]> } {
  return {
    loadSender: async () => sender,
    consume: async () => true,
    now: () => at,
    ...over,
    send: vi.fn<SupportDeps["send"]>(over.send ?? (async () => {})),
  };
}

describe("cleaning text", () => {
  it("keeps line breaks in a body but drops control characters and long runs of blank lines", () => {
    expect(cleanText("  a\r\nb\u0000\u0007c\n\n\n\nd\u202Ee  ")).toBe("a\nbc\n\nde");
  });

  it("turns a header into one line, so nothing can add another header", () => {
    const injected = "Hello\r\nBcc: someone@else.com\nX-Evil: 1\u2028more";
    const line = cleanHeader(injected);
    expect(line).not.toMatch(/[\r\n\u2028]/);
    expect(line).toBe("Hello Bcc: someone@else.com X-Evil: 1 more");
  });

  it("shortens a long header with an ellipsis", () => {
    const line = cleanHeader("x".repeat(300), 50);
    expect(line).toHaveLength(50);
    expect(line.endsWith("…")).toBe(true);
  });
});

describe("validating a form", () => {
  it("accepts a filled form and trims it", () => {
    const parsed = parseSupportInput("contact", { subject: "  Hi  ", message: "  A question.\n" });
    expect(parsed).toEqual({ ok: true, values: { subject: "Hi", message: "A question." } });
  });

  it("refuses an empty required field, naming it", () => {
    expect(parseSupportInput("contact", { subject: "   ", message: "x" })).toMatchObject({ ok: false, error: "Subject is required.", field: "subject" });
    expect(parseSupportInput("bug", { happened: "It broke", expected: "", steps: "", where: "" })).toMatchObject({ ok: false, error: "What did you expect is required." });
  });

  it("allows an optional field to be empty or missing", () => {
    const parsed = parseSupportInput("bug", { happened: "It broke", expected: "It works" });
    expect(parsed).toEqual({ ok: true, values: { happened: "It broke", expected: "It works", steps: "", where: "" } });
  });

  it("refuses a message over the limit and says by how much", () => {
    const parsed = parseSupportInput("feedback", { type: "other", message: "a".repeat(MESSAGE_MAX + 1) });
    expect(parsed).toMatchObject({ ok: false, field: "message" });
    expect(parsed.ok ? "" : parsed.error).toContain(`${MESSAGE_MAX + 1} of ${MESSAGE_MAX}`);
    expect(parseSupportInput("feedback", { type: "other", message: "a".repeat(MESSAGE_MAX) }).ok).toBe(true);
  });

  it("refuses a choice that is not offered, and values that are not text", () => {
    expect(parseSupportInput("feedback", { type: "complaint", message: "x" }).ok).toBe(false);
    expect(parseSupportInput("contact", { subject: { a: 1 }, message: "x" }).ok).toBe(false);
    expect(parseSupportInput("contact", null).ok).toBe(false);
  });

  it("starts a select on its first choice", () => {
    expect(emptyValues("feedback")).toEqual({ type: "suggestion", message: "" });
  });
});

describe("the email", () => {
  it("has a tagged one-line subject for each kind", () => {
    expect(supportSubject("bug", { happened: "The feed\nis empty", expected: "x" })).toBe("[Bug] The feed");
    expect(supportSubject("feedback", { type: "compliment", message: "Love it" })).toBe("[Feedback] Compliment: Love it");
    expect(supportSubject("contact", { subject: "Hi\r\nBcc: x@y.z", message: "m" })).toBe("[Contact] Hi");
    expect(supportSubject("contact", { subject: "Hi\u2028Bcc: x@y.z", message: "m" })).not.toMatch(/[\r\n\u2028]/);
  });

  it("names who sent it, their account and when, and sets the reply address", () => {
    const email = buildSupportEmail({ kind: "contact", values: { subject: "Hello", message: "Line one\nLine two" }, sender, at });
    expect(email.replyTo).toBe("juan@example.com");
    expect(email.subject).toBe("[Contact] Hello");
    expect(email.text).toContain("Kind: Contact");
    expect(email.text).toContain("From: @juan");
    expect(email.text).toContain("Display name: Juan Dela Cruz");
    expect(email.text).toContain("Role: Student");
    expect(email.text).toContain("Account email: juan@example.com");
    expect(email.text).toContain("Sent: 2026-10-25 15:04:05 (Asia/Manila)");
    expect(email.text).toContain("Subject: Hello");
    expect(email.text).toContain("Message:\nLine one\nLine two");
  });

  it("lists the optional bug fields only when filled, and shows a choice by its label", () => {
    const bug = buildSupportEmail({ kind: "bug", values: { happened: "Broke", expected: "Works", steps: "", where: "Messages" }, sender, at });
    expect(bug.text).toContain("What happened:\nBroke");
    expect(bug.text).toContain("Page or screen: Messages");
    expect(bug.text).not.toContain("Steps to repeat it");
    const feedback = buildSupportEmail({ kind: "feedback", values: { type: "suggestion", message: "More" }, sender, at });
    expect(feedback.text).toContain("Type: Suggestion");
  });

  it("does not trust the account email as a header", () => {
    const email = buildSupportEmail({ kind: "contact", values: { subject: "s", message: "m" }, sender: { ...sender, email: "a@b.c\r\nBcc: x@y.z" }, at });
    expect(email.replyTo).toBeUndefined();
    expect(email.text).not.toMatch(/Account email: a@b\.c\r?\n/);
  });

  it("writes Philippine time", () => {
    expect(manilaTime(new Date("2026-12-31T20:00:00.000Z"))).toBe("2027-01-01 04:00:00 (Asia/Manila)");
  });
});

describe("sending a message", () => {
  const values = { subject: "Hello", message: "A question." };

  it("emails the owner and reports success", async () => {
    const d = deps();
    expect(await sendSupportMessage(d, { studentId: "s1", kind: "contact", values })).toEqual({ ok: true });
    expect(d.send).toHaveBeenCalledTimes(1);
    expect(d.send).toHaveBeenCalledWith(expect.objectContaining({ to: SUPPORT_EMAIL, subject: "[Contact] Hello", replyTo: "juan@example.com" }));
  });

  it("sends nothing for an invalid form and does not use up the allowance", async () => {
    const consume = vi.fn(async () => true);
    const d = deps({ consume });
    expect(await sendSupportMessage(d, { studentId: "s1", kind: "contact", values: { subject: "", message: "" } })).toMatchObject({ ok: false, error: "Subject is required." });
    expect(await sendSupportMessage(d, { studentId: "s1", kind: "nonsense", values })).toMatchObject({ ok: false });
    expect(consume).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
  });

  it("refuses an hourly or daily overflow with a clear message and sends nothing", async () => {
    const hour = deps({ consume: async (limit) => limit.action !== "support_message_hour" });
    expect(await sendSupportMessage(hour, { studentId: "s1", kind: "contact", values })).toEqual({ ok: false, error: SUPPORT_TOO_FAST });
    const day = deps({ consume: async (limit) => limit.action !== "support_message_day" });
    expect(await sendSupportMessage(day, { studentId: "s1", kind: "contact", values })).toEqual({ ok: false, error: SUPPORT_DAY_LIMIT });
    expect(hour.send).not.toHaveBeenCalled();
    expect(day.send).not.toHaveBeenCalled();
  });

  it("counts each student separately", async () => {
    const consume = vi.fn(async () => true);
    await sendSupportMessage(deps({ consume }), { studentId: "s9", kind: "contact", values });
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ key: "s9" }));
  });

  it("never says it was sent when the mail quota is spent or the provider fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const quota = deps({ send: vi.fn(async () => { throw new MailQuotaError(); }) });
    expect(await sendSupportMessage(quota, { studentId: "s1", kind: "contact", values })).toEqual({ ok: false, error: SUPPORT_NOT_SENT });
    const down = deps({ send: vi.fn(async () => { throw new Error("smtp down"); }) });
    expect(await sendSupportMessage(down, { studentId: "s1", kind: "contact", values })).toEqual({ ok: false, error: SUPPORT_NOT_SENT });
    error.mockRestore();
  });

  it("fails clearly when the account cannot be found", async () => {
    const d = deps({ loadSender: async () => null });
    expect(await sendSupportMessage(d, { studentId: "gone", kind: "contact", values })).toEqual({ ok: false, error: SUPPORT_NOT_SENT });
    expect(d.send).not.toHaveBeenCalled();
  });
});
