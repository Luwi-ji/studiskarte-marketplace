import { randomUUID } from "node:crypto";
import { eq, like, or } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/mail", () => ({
  MailQuotaError: class MailQuotaError extends Error {},
  sendMail: vi.fn(async (message: { to: string; subject: string; text: string }) => {
    sent.push(message);
  }),
}));

import { rateLimitEvent, session, student, verification } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { auth, requestPasswordResetCode, requestSignUpCode } from "@/lib/identity/auth";
import { MailQuotaError, sendMail } from "@/lib/mail";
import { createTestStudent } from "@/test/fixtures";

// Visitor sign-up is closed unless the deployment opens it; most tests need it open.
process.env.ALLOW_VISITORS = "true";

const db = getDb();
const run = randomUUID().slice(0, 8);
const school = (name: string) => `${name}-${run}@testschool.edu.ph`;
const visitor = (name: string) => `${name}-${run}@visitor.test`;

function lastCode(to: string): string {
  const message = [...sent].reverse().find((m) => m.to === to);
  const code = message?.text.match(/code is (\d{6})/)?.[1];
  if (!code) throw new Error(`no code was sent to ${to}`);
  return code;
}

const requestCode = (email: string) =>
  auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
const signUp = (email: string, otp: string) =>
  auth.api.signInEmailOTP({ body: { email, otp } });

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { body?: { code?: string }; status?: string };
  }
  throw new Error("expected the call to be rejected");
}

// Without a client address, Better Auth reports 127.0.0.1 in test and
// development, so every run shares one per-network-address counter. Reset it
// so earlier runs in the same hour cannot trip the limit here.
const LOCALHOST = "127.0.0.1";

beforeEach(async () => {
  sent.length = 0;
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, LOCALHOST));
});

afterAll(async () => {
  const mine = or(like(student.email, `%-${run}@testschool.edu.ph`), like(student.email, `%-${run}@visitor.test`));
  await db.delete(student).where(mine);
  await db.delete(verification).where(or(like(verification.identifier, `%-${run}@testschool.edu.ph`), like(verification.identifier, `%-${run}@visitor.test`)));
  await db.delete(rateLimitEvent).where(or(like(rateLimitEvent.key, `%-${run}@testschool.edu.ph`), like(rateLimitEvent.key, `%-${run}@visitor.test`)));
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, LOCALHOST));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("sending sign-up codes", () => {
  it.each(["not an email", "someone+tag@gmail.com", "someone@localhost", "a%b@gmail.com"])(
    "sends nothing and stores no code for %s",
    async (email) => {
      const error = await rejection(requestCode(email));
      expect(error.body?.code).toBe("INVALID_EMAIL");
      expect(sent).toHaveLength(0);
      const rows = await db.select().from(verification).where(like(verification.identifier, `%${email}`));
      expect(rows).toHaveLength(0);
    },
  );

  // The HTTP handler is not mounted (no /api/auth route), but the guard must hold if it ever is.
  it("cannot be bypassed through Better Auth's HTTP handler", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "attacker+x@gmail.com", type: "sign-in" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("stops after 3 requests for one address in the window", async () => {
    const email = school("limit");
    for (let i = 0; i < 3; i++) await requestCode(email);
    const error = await rejection(requestCode(email));
    expect(error.body?.code).toBe("TOO_MANY_REQUESTS");
    expect(sent.filter((m) => m.to === email)).toHaveLength(3);
  });

  it("reports a failed send instead of claiming the code went out", async () => {
    // Better Auth swallows errors from the send callback and answers success.
    vi.mocked(sendMail).mockRejectedValueOnce(new Error("535 Username and Password not accepted"));
    expect(await requestSignUpCode(school("smtpfail"), new Headers())).toEqual({ ok: false, reason: "send_failed" });
  });

  it("reports the daily mail quota separately", async () => {
    vi.mocked(sendMail).mockRejectedValueOnce(new MailQuotaError());
    expect(await requestSignUpCode(school("quota"), new Headers())).toEqual({ ok: false, reason: "mail_quota" });
  });

  it("reports success only when the mail was sent", async () => {
    const email = school("delivered");
    expect(await requestSignUpCode(email, new Headers())).toEqual({ ok: true });
    expect(sent.some((m) => m.to === email)).toBe(true);
  });

  it("sends nothing for an address that already has an account, and says so", async () => {
    const id = `exists-${run}`;
    const { email } = await createTestStudent(id);
    expect(await requestSignUpCode(email, new Headers())).toEqual({ ok: false, reason: "account_exists" });
    expect(sent).toHaveLength(0);
  });
});

describe("making the account with the code", () => {
  it("makes a student of the school for a school address", async () => {
    const email = school("ok");
    await requestCode(email);
    const result = await signUp(email, lastCode(email));
    expect(result.user.email).toBe(email);
    const [row] = await db.select().from(student).where(eq(student.email, email));
    expect(row).toMatchObject({ schoolDomain: "testschool.edu.ph", schoolEmail: email, role: "student", emailVerified: true, name: "" });
  });

  it("makes a visitor with no school for any other address", async () => {
    const email = visitor("guest");
    await requestCode(email);
    await signUp(email, lastCode(email));
    const [row] = await db.select().from(student).where(eq(student.email, email));
    expect(row).toMatchObject({ schoolDomain: null, schoolEmail: null, role: "visitor", emailVerified: true });
  });

  it("is not a way into an existing account: the code of an address with an account is refused", async () => {
    const id = `existing-${run}`;
    const { email } = await createTestStudent(id);
    await requestCode(email);
    const error = await rejection(signUp(email, "123456"));
    expect(error.body?.code).toBe("INVALID_OTP");
    expect(await db.select().from(session).where(eq(session.userId, id))).toHaveLength(0);
  });

  it("keeps one live code per address: a new request cancels the old code", async () => {
    const email = school("rotate");
    await requestCode(email);
    const first = lastCode(email);
    await requestCode(email);
    const second = lastCode(email);
    expect(second).not.toBe(first);

    const error = await rejection(signUp(email, first));
    expect(error.body?.code).toBe("INVALID_OTP");
    await expect(signUp(email, second)).resolves.toBeTruthy();
  });

  it("uses a code once", async () => {
    const email = school("once");
    await requestCode(email);
    const code = lastCode(email);
    await signUp(email, code);
    const error = await rejection(signUp(email, code));
    expect(error.body?.code).toBe("INVALID_OTP");
  });

  it("locks the code after 3 wrong tries, even for the right code", async () => {
    const email = school("lock");
    await requestCode(email);
    const right = lastCode(email);
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) {
      const error = await rejection(signUp(email, wrong));
      expect(error.body?.code).toBe("INVALID_OTP");
    }
    const locked = await rejection(signUp(email, right));
    expect(locked.body?.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("rejects an expired code", async () => {
    const email = school("expired");
    await requestCode(email);
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(like(verification.identifier, `%${email}`));
    const error = await rejection(signUp(email, lastCode(email)));
    expect(error.body?.code).toBe("OTP_EXPIRED");
  });

  it("refuses a malformed address even with a code", async () => {
    const error = await rejection(signUp("attacker+x@gmail.com", "123456"));
    expect(error.body?.code).toBe("INVALID_EMAIL");
  });
});

describe("while visitor sign-up is closed", () => {
  it("sends nothing to a personal address and makes no account, but a school address still works", async () => {
    process.env.ALLOW_VISITORS = "false";
    try {
      const email = visitor("closed");
      expect(await requestSignUpCode(email, new Headers())).toEqual({ ok: false, reason: "visitors_closed" });
      expect(sent).toHaveLength(0);
      const error = await rejection(signUp(email, "123456"));
      expect(error.body?.code).toBe("VISITORS_CLOSED");
      expect(await db.select().from(student).where(eq(student.email, email))).toHaveLength(0);
      expect(await requestSignUpCode(school("stillopen"), new Headers())).toEqual({ ok: true });
    } finally {
      process.env.ALLOW_VISITORS = "true";
    }
  });
});

describe("password reset codes", () => {
  it("send nothing for a suspended account and answer like any other", async () => {
    const { email } = await createTestStudent(`susp-${run}`, { accountStatus: "suspended" });
    expect(await requestPasswordResetCode(email, new Headers())).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it("send nothing for an unknown address and answer the same", async () => {
    expect(await requestPasswordResetCode(school("nobody"), new Headers())).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it("go to the account's sign-in email", async () => {
    const { email } = await createTestStudent(`reset-${run}`);
    expect(await requestPasswordResetCode(email, new Headers())).toEqual({ ok: true });
    expect(sent.filter((m) => m.to === email)).toHaveLength(1);
    expect(sent[0].subject).toMatch(/reset/i);
  });
});
