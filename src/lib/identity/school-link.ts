import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { school, student, verification } from "@/db/schema";
import { getDb } from "@/lib/db";
import { clientIp } from "@/lib/identity/auth";
import { parseSchoolRole, type SchoolRole } from "@/lib/identity/roles";
import { parseSchoolEmail } from "@/lib/identity/school-email";
import { MailQuotaError, sendMail } from "@/lib/mail";
import { isUniqueViolation } from "@/lib/messaging/send";
import { consume } from "@/lib/rate-limit";

// A visitor attaches a school email: a code goes to that address, and the right
// code makes the account a student (or faculty, staff, alumni) of that school.
// Better Auth's code store is tied to sign-in addresses, so this keeps its own
// single-use, expiring, attempt-limited code in the same `verification` table.

const CODE_EXPIRES_SECONDS = 10 * 60;
const CODE_ALLOWED_ATTEMPTS = 3;
const REQUESTS_PER_STUDENT = { max: 3, windowSeconds: 15 * 60 };
const REQUESTS_PER_IP = { max: 10, windowSeconds: 60 * 60 };

export const NOT_SCHOOL_EMAIL = "Use your school email address ending in .edu.ph.";
export const SCHOOL_EMAIL_TAKEN = "That school email already belongs to an account. Sign in to that account instead.";
export const ALREADY_ATTACHED = "A school email is already attached to this account.";
export const LINK_BAD_CODE = "That code did not work. Check it or ask for a new one.";
export const LINK_TOO_MANY = "Too many attempts. Try again later.";
export const LINK_NO_MAIL = "We could not send the code. Try again later.";

export type LinkRequestResult = { ok: true; email: string } | { ok: false; error: string };

const identifierFor = (studentId: string) => `school-link:${studentId}`;

function digest(studentId: string, email: string, code: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET must be set");
  return createHmac("sha256", secret).update(`${studentId}\n${email}\n${code}`).digest("hex");
}

async function isVisitor(studentId: string): Promise<boolean> {
  const [me] = await getDb()
    .select({ role: student.role, status: student.accountStatus })
    .from(student)
    .where(eq(student.id, studentId));
  return me !== undefined && me.status === "active" && me.role === "visitor";
}

/** Sends a code to a school email the visitor says is theirs. Nothing is attached yet. */
export async function requestSchoolEmailCode(args: { studentId: string; rawEmail: string; headers: Headers }): Promise<LinkRequestResult> {
  const parsed = parseSchoolEmail(args.rawEmail);
  if (!parsed) return { ok: false, error: NOT_SCHOOL_EMAIL };
  if (!(await isVisitor(args.studentId))) return { ok: false, error: ALREADY_ATTACHED };

  const ip = clientIp(args.headers);
  const allowed = await consume({ action: "school_link:student", key: args.studentId, ...REQUESTS_PER_STUDENT });
  const ipAllowed = ip ? await consume({ action: "school_link:ip", key: ip, ...REQUESTS_PER_IP }) : true;
  if (!allowed || !ipAllowed) return { ok: false, error: LINK_TOO_MANY };

  const [taken] = await getDb().select({ id: student.id }).from(student).where(eq(student.schoolEmail, parsed.email));
  if (taken) return { ok: false, error: SCHOOL_EMAIL_TAKEN };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(verification).where(eq(verification.identifier, identifierFor(args.studentId)));
    await tx.insert(verification).values({
      id: randomUUID(),
      identifier: identifierFor(args.studentId),
      value: `${digest(args.studentId, parsed.email, code)}|${parsed.email}|0`,
      expiresAt: new Date(Date.now() + CODE_EXPIRES_SECONDS * 1000),
    });
  });
  try {
    await sendMail({
      to: parsed.email,
      subject: "Your Studiskarte school email code",
      text: `Your Studiskarte Marketplace code is ${code}.\nIt expires in ${CODE_EXPIRES_SECONDS / 60} minutes. If you did not ask for it, ignore this message.`,
    });
  } catch (error) {
    await db.delete(verification).where(eq(verification.identifier, identifierFor(args.studentId)));
    if (error instanceof MailQuotaError) return { ok: false, error: LINK_TOO_MANY };
    console.error("sending a school email code failed", error);
    return { ok: false, error: LINK_NO_MAIL };
  }
  return { ok: true, email: parsed.email };
}

export type LinkConfirmResult = { ok: true } | { ok: false; error: string };

/** Checks the code and, if right, attaches the school email and sets the role. */
export async function confirmSchoolEmail(args: { studentId: string; rawEmail: string; code: string; role: unknown }): Promise<LinkConfirmResult> {
  const parsed = parseSchoolEmail(args.rawEmail);
  const role: SchoolRole | null = parseSchoolRole(args.role);
  const code = args.code.replace(/\s+/g, "");
  if (!parsed || !role || !/^\d{6}$/.test(code)) return { ok: false, error: LINK_BAD_CODE };

  const db = getDb();
  return db.transaction(async (tx): Promise<LinkConfirmResult> => {
    const [row] = await tx
      .select({ id: verification.id, value: verification.value, expiresAt: verification.expiresAt })
      .from(verification)
      .where(eq(verification.identifier, identifierFor(args.studentId)))
      .for("update");
    if (!row) return { ok: false, error: LINK_BAD_CODE };
    const [stored, storedEmail, attemptsText] = row.value.split("|");
    const attempts = Number(attemptsText);
    if (row.expiresAt.getTime() < Date.now() || attempts >= CODE_ALLOWED_ATTEMPTS || storedEmail !== parsed.email) {
      await tx.delete(verification).where(eq(verification.id, row.id));
      return { ok: false, error: LINK_BAD_CODE };
    }
    const expected = Buffer.from(stored, "hex");
    const given = Buffer.from(digest(args.studentId, parsed.email, code), "hex");
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      await tx.update(verification).set({ value: `${stored}|${storedEmail}|${attempts + 1}` }).where(eq(verification.id, row.id));
      return { ok: false, error: LINK_BAD_CODE };
    }
    await tx.delete(verification).where(eq(verification.id, row.id));

    await tx.insert(school).values({ domain: parsed.domain }).onConflictDoNothing();
    try {
      const attached = await tx
        .update(student)
        .set({ schoolEmail: parsed.email, schoolDomain: parsed.domain, role, updatedAt: new Date() })
        .where(and(eq(student.id, args.studentId), eq(student.role, "visitor"), eq(student.accountStatus, "active"), isNull(student.schoolEmail)))
        .returning({ id: student.id });
      return attached.length === 1 ? { ok: true } : { ok: false, error: ALREADY_ATTACHED };
    } catch (error) {
      if (isUniqueViolation(error)) return { ok: false, error: SCHOOL_EMAIL_TAKEN };
      throw error;
    }
  });
}
