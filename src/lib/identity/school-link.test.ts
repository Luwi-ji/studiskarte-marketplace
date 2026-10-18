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

import { rateLimitEvent, student, verification } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import {
  ALREADY_ATTACHED,
  confirmSchoolEmail,
  LINK_BAD_CODE,
  LINK_TOO_MANY,
  NOT_SCHOOL_EMAIL,
  requestSchoolEmailCode,
  SCHOOL_EMAIL_TAKEN,
} from "@/lib/identity/school-link";
import { createTestStudent } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 8);
const headers = new Headers();
const schoolAddress = (name: string) => `${name}-${run}@testschool.edu.ph`;

function lastCode(to: string): string {
  const message = [...sent].reverse().find((m) => m.to === to);
  const code = message?.text.match(/code is (\d{6})/)?.[1];
  if (!code) throw new Error(`no code was sent to ${to}`);
  return code;
}

async function visitor(name: string) {
  const id = `${name}-${run}`;
  await createTestStudent(id, { visitor: true });
  return id;
}

async function row(id: string) {
  const [found] = await db.select().from(student).where(eq(student.id, id));
  return found;
}

beforeEach(async () => {
  sent.length = 0;
  await db.delete(rateLimitEvent).where(eq(rateLimitEvent.key, "127.0.0.1"));
});

afterAll(async () => {
  await db.delete(student).where(or(like(student.id, `%-${run}`), like(student.email, `%-${run}@%`)));
  await db.delete(verification).where(like(verification.identifier, `school-link:%-${run}`));
  await db.delete(rateLimitEvent).where(or(like(rateLimitEvent.key, `%-${run}%`), eq(rateLimitEvent.key, "127.0.0.1")));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("attaching a school email to a visitor", () => {
  it("makes the visitor a member of the school once the right code is typed", async () => {
    const id = await visitor("attach");
    const email = schoolAddress("attach");
    expect(await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers })).toEqual({ ok: true, email });
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: email, code: lastCode(email), role: "faculty" })).toEqual({ ok: true });
    expect(await row(id)).toMatchObject({ role: "faculty", schoolEmail: email, schoolDomain: "testschool.edu.ph" });
  });

  it("refuses an address that is not a school address, and sends nothing", async () => {
    const id = await visitor("notschool");
    expect(await requestSchoolEmailCode({ studentId: id, rawEmail: "someone@gmail.com", headers })).toEqual({ ok: false, error: NOT_SCHOOL_EMAIL });
    expect(sent).toHaveLength(0);
  });

  it("refuses a school email that already belongs to an account, and sends nothing", async () => {
    const { email } = await createTestStudent(`owner-${run}`);
    const id = await visitor("taken");
    expect(await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers })).toEqual({ ok: false, error: SCHOOL_EMAIL_TAKEN });
    expect(sent).toHaveLength(0);
  });

  it("refuses someone who already has a school email", async () => {
    const { id } = await createTestStudent(`member-${run}`);
    expect(await requestSchoolEmailCode({ studentId: id, rawEmail: schoolAddress("another"), headers })).toEqual({ ok: false, error: ALREADY_ATTACHED });
    expect(sent).toHaveLength(0);
  });

  it("does not take a wrong code, a code for another address, or an unknown role, and leaves the account a visitor", async () => {
    const id = await visitor("wrong");
    const email = schoolAddress("wrong");
    await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers });
    const right = lastCode(email);
    const wrong = right === "000000" ? "111111" : "000000";
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: email, code: wrong, role: "student" })).toEqual({ ok: false, error: LINK_BAD_CODE });
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: schoolAddress("other"), code: right, role: "student" })).toEqual({ ok: false, error: LINK_BAD_CODE });
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: email, code: right, role: "visitor" })).toEqual({ ok: false, error: LINK_BAD_CODE });
    expect(await row(id)).toMatchObject({ role: "visitor", schoolEmail: null, schoolDomain: null });
  });

  it("locks the code after 3 wrong tries, even for the right code", async () => {
    const id = await visitor("lock");
    const email = schoolAddress("lock");
    await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers });
    const right = lastCode(email);
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 3; i++) await confirmSchoolEmail({ studentId: id, rawEmail: email, code: wrong, role: "student" });
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: email, code: right, role: "student" })).toEqual({ ok: false, error: LINK_BAD_CODE });
    expect((await row(id)).role).toBe("visitor");
  });

  it("uses a code once and rejects an expired one", async () => {
    const id = await visitor("once");
    const email = schoolAddress("once");
    await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers });
    const code = lastCode(email);
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: email, code, role: "student" })).toEqual({ ok: true });
    expect(await confirmSchoolEmail({ studentId: id, rawEmail: email, code, role: "student" })).toMatchObject({ ok: false });

    const late = await visitor("late");
    const lateEmail = schoolAddress("late");
    await requestSchoolEmailCode({ studentId: late, rawEmail: lateEmail, headers });
    await db.update(verification).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(verification.identifier, `school-link:${late}`));
    expect(await confirmSchoolEmail({ studentId: late, rawEmail: lateEmail, code: lastCode(lateEmail), role: "student" })).toEqual({ ok: false, error: LINK_BAD_CODE });
    expect((await row(late)).role).toBe("visitor");
  });

  it("lets only one of two accounts have the same school email", async () => {
    const email = schoolAddress("shared");
    const first = await visitor("first");
    const second = await visitor("second");
    await requestSchoolEmailCode({ studentId: first, rawEmail: email, headers });
    const firstCode = lastCode(email);
    await requestSchoolEmailCode({ studentId: second, rawEmail: email, headers });
    const secondCode = lastCode(email);
    expect(await confirmSchoolEmail({ studentId: first, rawEmail: email, code: firstCode, role: "student" })).toEqual({ ok: true });
    expect(await confirmSchoolEmail({ studentId: second, rawEmail: email, code: secondCode, role: "student" })).toEqual({ ok: false, error: SCHOOL_EMAIL_TAKEN });
    expect((await row(second)).role).toBe("visitor");
  });

  it("stops after 3 code requests in the window", async () => {
    const id = await visitor("limit");
    const email = schoolAddress("limit");
    for (let i = 0; i < 3; i++) await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers });
    expect(await requestSchoolEmailCode({ studentId: id, rawEmail: email, headers })).toEqual({ ok: false, error: LINK_TOO_MANY });
    expect(sent).toHaveLength(3);
  });
});
