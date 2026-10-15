import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; text: string }[] = [];
vi.mock("@/lib/mail", () => ({
  sendMail: vi.fn(async (message: { to: string; subject: string; text: string }) => {
    sent.push(message);
  }),
}));

import { rateLimitEvent, student, verification } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { auth } from "@/lib/identity/auth";

const db = getDb();
const run = randomUUID().slice(0, 8);
const address = (name: string) => `${name}-${run}@testschool.edu.ph`;

function lastCode(to: string): string {
  const message = [...sent].reverse().find((m) => m.to === to);
  const code = message?.text.match(/code is (\d{6})/)?.[1];
  if (!code) throw new Error(`no code was sent to ${to}`);
  return code;
}

const requestCode = (email: string) =>
  auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
const signIn = (email: string, otp: string) =>
  auth.api.signInEmailOTP({ body: { email, otp } });

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as { body?: { code?: string }; status?: string };
  }
  throw new Error("expected the call to be rejected");
}

beforeEach(() => {
  sent.length = 0;
});

afterAll(async () => {
  await db.delete(student).where(like(student.email, `%-${run}@testschool.edu.ph`));
  await db.delete(verification).where(like(verification.identifier, `%-${run}@testschool.edu.ph`));
  await db.delete(rateLimitEvent).where(like(rateLimitEvent.key, `%-${run}@testschool.edu.ph`));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("sending codes", () => {
  it.each(["someone@gmail.com", "someone@up.edu.ph.evil.com", "someone@edu.ph"])(
    "sends nothing and stores no code for %s",
    async (email) => {
      const error = await rejection(requestCode(email));
      expect(error.body?.code).toBe("NOT_SCHOOL_EMAIL");
      expect(sent).toHaveLength(0);
      const rows = await db
        .select()
        .from(verification)
        .where(like(verification.identifier, `%${email}`));
      expect(rows).toHaveLength(0);
    },
  );

  it("cannot be bypassed through the public HTTP endpoint", async () => {
    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "attacker@gmail.com", type: "sign-in" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("stops after 3 requests for one address in the window", async () => {
    const email = address("limit");
    for (let i = 0; i < 3; i++) await requestCode(email);
    const error = await rejection(requestCode(email));
    expect(error.body?.code).toBe("TOO_MANY_REQUESTS");
    expect(sent.filter((m) => m.to === email)).toHaveLength(3);
  });
});

describe("code lifecycle", () => {
  it("signs in with the emailed code and records the school domain", async () => {
    const email = address("ok");
    await requestCode(email);
    const result = await signIn(email, lastCode(email));
    expect(result.user.email).toBe(email);
    const [row] = await db.select().from(student).where(eq(student.email, email));
    expect(row.schoolDomain).toBe("testschool.edu.ph");
    expect(row.emailVerified).toBe(true);
  });

  it("keeps one live code per address: a new request cancels the old code", async () => {
    const email = address("rotate");
    await requestCode(email);
    const first = lastCode(email);
    await requestCode(email);
    const second = lastCode(email);
    expect(second).not.toBe(first);

    const error = await rejection(signIn(email, first));
    expect(error.body?.code).toBe("INVALID_OTP");
    await expect(signIn(email, second)).resolves.toBeTruthy();
  });

  it("uses a code once", async () => {
    const email = address("once");
    await requestCode(email);
    const code = lastCode(email);
    await signIn(email, code);
    const error = await rejection(signIn(email, code));
    expect(error.body?.code).toBe("INVALID_OTP");
  });

  it("locks the code after 3 wrong tries, even for the right code", async () => {
    const email = address("lock");
    await requestCode(email);
    const right = lastCode(email);
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) {
      const error = await rejection(signIn(email, wrong));
      expect(error.body?.code).toBe("INVALID_OTP");
    }
    const locked = await rejection(signIn(email, right));
    expect(locked.body?.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("rejects an expired code", async () => {
    const email = address("expired");
    await requestCode(email);
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(like(verification.identifier, `%${email}`));
    const error = await rejection(signIn(email, lastCode(email)));
    expect(error.body?.code).toBe("OTP_EXPIRED");
  });

  it("refuses to sign in a non-school address even with a code", async () => {
    const error = await rejection(signIn("attacker@gmail.com", "123456"));
    expect(error.body?.code).toBe("NOT_SCHOOL_EMAIL");
  });
});
