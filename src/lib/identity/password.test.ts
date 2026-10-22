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

import { account, rateLimitEvent, session, student, verification } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { auth } from "@/lib/identity/auth";
import { hasPassword, loginWithPassword, requestPasswordReset, resetPasswordWithCode, setFirstPassword } from "@/lib/identity/password";
import { createTestStudent } from "@/test/fixtures";

process.env.ALLOW_VISITORS = "true";

const db = getDb();
const run = randomUUID().slice(0, 8);
const PASSWORD = "correct horse battery";
const headers = new Headers();

function lastCode(to: string): string {
  const message = [...sent].reverse().find((m) => m.to === to);
  const code = message?.text.match(/code is (\d{6})/)?.[1];
  if (!code) throw new Error(`no code was sent to ${to}`);
  return code;
}

/** An active account with a password, as a person has after sign-up. */
async function accountWithPassword(name: string, fields: Parameters<typeof createTestStudent>[1] = {}, password = PASSWORD) {
  const id = `${name}-${run}`;
  const made = await createTestStudent(id, fields);
  const context = await auth.$context;
  await context.internalAdapter.linkAccount({ userId: id, providerId: "credential", accountId: id, password: await context.password.hash(password) });
  return made;
}

// Without a client address Better Auth reports 127.0.0.1, so every run shares one per-network counter.
beforeEach(async () => {
  sent.length = 0;
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, "127.0.0.1"));
});

afterAll(async () => {
  const mine = or(like(student.email, `%-${run}@%`), like(student.handle, `%-${run}`));
  await db.delete(student).where(mine);
  await db.delete(verification).where(like(verification.identifier, `%-${run}@%`));
  await db.delete(rateLimitEvent).where(or(like(rateLimitEvent.key, `%-${run}%`), eq(rateLimitEvent.key, "127.0.0.1")));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("logging in with a password", () => {
  it("accepts the sign-in email and makes a session", async () => {
    const { id, email } = await accountWithPassword("byemail");
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: true });
    expect((await db.select().from(session).where(eq(session.userId, id))).length).toBeGreaterThan(0);
  });

  it("accepts the handle, with or without @ and in any case", async () => {
    await accountWithPassword("byhandle", { handle: `byhandle-${run}`.replace("-", "_") });
    const handle = `byhandle_${run}`;
    expect(await loginWithPassword(handle, PASSWORD, headers)).toEqual({ ok: true });
    expect(await loginWithPassword(`@${handle.toUpperCase()}`, PASSWORD, headers)).toEqual({ ok: true });
  });

  it("accepts a school email attached to a visitor's account", async () => {
    const { id } = await accountWithPassword("attached", { visitor: true });
    const schoolEmail = `attached-${run}@testschool.edu.ph`;
    await db.update(student).set({ role: "student", schoolEmail, schoolDomain: "testschool.edu.ph" }).where(eq(student.id, id));
    expect(await loginWithPassword(schoolEmail, PASSWORD, headers)).toEqual({ ok: true });
  });

  it("refuses a wrong password, an unknown address and an unknown handle the same way", async () => {
    const { email } = await accountWithPassword("wrongpw");
    expect(await loginWithPassword(email, "not the password", headers)).toEqual({ ok: false, reason: "wrong" });
    expect(await loginWithPassword(`nobody-${run}@testschool.edu.ph`, PASSWORD, headers)).toEqual({ ok: false, reason: "wrong" });
    expect(await loginWithPassword(`nobody_${run}`, PASSWORD, headers)).toEqual({ ok: false, reason: "wrong" });
  });

  it("refuses a suspended account even with the right password, and says why only then", async () => {
    const { email } = await accountWithPassword("suspended", { accountStatus: "suspended" });
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: false, reason: "suspended" });
    // A wrong password gives nothing away: nobody can find out who is suspended.
    expect(await loginWithPassword(email, "not the password", headers)).toEqual({ ok: false, reason: "wrong" });
  });

  it("refuses an account that has no password yet", async () => {
    const { email } = await createTestStudent(`nopw-${run}`);
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: false, reason: "wrong" });
  });

  it("stops after 10 tries for one name in an hour, even with the right password", async () => {
    const { email } = await accountWithPassword("limited");
    for (let i = 0; i < 10; i++) await loginWithPassword(email, "wrong password", headers);
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: false, reason: "too_many_requests" });
  });
});

describe("the first password after a code", () => {
  it("is set once for the signed-in account, then login works and a second set is refused", async () => {
    const email = `fresh-${run}@visitor.test`;
    await auth.api.sendVerificationOTP({ body: { email, type: "sign-in" } });
    const made = await auth.api.signInEmailOTP({ body: { email, otp: lastCode(email) }, returnHeaders: true });
    const cookie = (made.headers.get("set-cookie") ?? "").split(/,(?=\s*[\w.-]+=)/).map((c) => c.split(";")[0].trim()).join("; ");
    const signedIn = new Headers({ cookie });

    expect(await hasPassword(made.response.user.id)).toBe(false);
    expect(await setFirstPassword("short", signedIn)).toMatchObject({ ok: false });
    expect(await setFirstPassword(PASSWORD, signedIn)).toEqual({ ok: true });
    expect(await hasPassword(made.response.user.id)).toBe(true);
    expect(await setFirstPassword("another long password", signedIn)).toMatchObject({ ok: false });
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: true });
  });
});

describe("resetting a forgotten password", () => {
  it("works from the code, ends other sessions and signs in with the new password", async () => {
    const { id, email } = await accountWithPassword("resets", { handle: `resets_${run}` });
    await loginWithPassword(email, PASSWORD, headers);
    const before = await db.select().from(session).where(eq(session.userId, id));
    expect(before.length).toBeGreaterThan(0);

    // A handle works too; the code goes to the sign-in email.
    expect(await requestPasswordReset(`resets_${run}`, headers)).toEqual({ ok: true });
    const code = lastCode(email);
    const result = await resetPasswordWithCode({ identifier: `resets_${run}`, code, password: "a brand new password", headers });
    expect(result).toEqual({ ok: true });

    const after = await db.select().from(session).where(eq(session.userId, id));
    expect(after.map((s) => s.id)).not.toEqual(expect.arrayContaining(before.map((s) => s.id)));
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: false, reason: "wrong" });
    expect(await loginWithPassword(email, "a brand new password", headers)).toEqual({ ok: true });
  });

  it("gives an account that never had a password its first one", async () => {
    const { id, email } = await createTestStudent(`legacy-${run}`);
    expect(await hasPassword(id)).toBe(false);
    await requestPasswordReset(email, headers);
    expect(await resetPasswordWithCode({ identifier: email, code: lastCode(email), password: PASSWORD, headers })).toEqual({ ok: true });
    expect(await hasPassword(id)).toBe(true);
    expect((await db.select().from(account).where(eq(account.userId, id))).map((a) => a.providerId)).toEqual(["credential"]);
  });

  it("refuses a wrong code, and a password that is too short, and changes nothing", async () => {
    const { email } = await accountWithPassword("badcode");
    await requestPasswordReset(email, headers);
    const right = lastCode(email);
    const wrong = right === "000000" ? "111111" : "000000";
    expect(await resetPasswordWithCode({ identifier: email, code: wrong, password: "a brand new password", headers })).toEqual({ ok: false, reason: "bad_code" });
    expect(await resetPasswordWithCode({ identifier: email, code: right, password: "short", headers })).toEqual({ ok: false, reason: "weak_password" });
    expect(await loginWithPassword(email, PASSWORD, headers)).toEqual({ ok: true });
  });

  it("sends nothing and gives a bad-code answer for a name with no account", async () => {
    const who = `ghost-${run}@testschool.edu.ph`;
    expect(await requestPasswordReset(who, headers)).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
    expect(await resetPasswordWithCode({ identifier: who, code: "123456", password: PASSWORD, headers })).toEqual({ ok: false, reason: "bad_code" });
  });
});
