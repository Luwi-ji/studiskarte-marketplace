import { and, eq, isNotNull, or } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { account, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { auth, clientIp, requestPasswordResetCode, type CodeRequestResult } from "@/lib/identity/auth";
import { PASSWORD_MAX, PASSWORD_RULE, passwordAcceptable } from "@/lib/identity/password-rules";
import { parseEmail } from "@/lib/identity/school-email";
import { consume } from "@/lib/rate-limit";

const LOGIN_TRIES_PER_IDENTIFIER = { max: 10, windowSeconds: 60 * 60 };
const LOGIN_TRIES_PER_IP = { max: 30, windowSeconds: 60 * 60 };
const RESET_LOOKUPS_PER_IP = { max: 10, windowSeconds: 60 * 60 };

/** Used to spend the same hashing time when no account matches, so timing does not show which names exist. */
const NO_ACCOUNT_EMAIL = "nobody@account.invalid";

type Found = { id: string; email: string; status: string; role: string };

/**
 * What a person typed to say who they are: an email address (the sign-in email or
 * the attached school email) or a handle, with or without the leading @.
 */
export async function findByIdentifier(raw: string): Promise<Found | null> {
  const typed = raw.trim().toLowerCase().replace(/^@/, "");
  if (typed === "") return null;
  const columns = { id: student.id, email: student.email, status: student.accountStatus, role: student.role };
  if (typed.includes("@")) {
    const parsed = parseEmail(typed);
    if (!parsed) return null;
    const [row] = await getDb()
      .select(columns)
      .from(student)
      .where(or(eq(student.email, parsed.email), eq(student.schoolEmail, parsed.email)));
    return row ?? null;
  }
  const [row] = await getDb().select(columns).from(student).where(eq(student.handle, typed));
  return row ?? null;
}

export type LoginResult = { ok: true } | { ok: false; reason: "wrong" | "too_many_requests" | "suspended" };

/**
 * Signs in with an email or handle and a password. Every failure looks the same, except the rate limit and one more:
 * a suspended person who gives the right password is told their account is suspended, so they know why they cannot get in.
 * With a wrong password a suspended account looks like any other failure, so nobody can find out who is suspended.
 */
export async function loginWithPassword(identifier: string, password: string, headers: Headers): Promise<LoginResult> {
  const typed = identifier.trim().toLowerCase().replace(/^@/, "");
  if (typed === "" || typed.length > 254 || password === "" || password.length > PASSWORD_MAX) {
    return { ok: false, reason: "wrong" };
  }
  const ip = clientIp(headers);
  const identifierAllowed = await consume({ action: "login:identifier", key: typed, ...LOGIN_TRIES_PER_IDENTIFIER });
  const ipAllowed = ip ? await consume({ action: "login:ip", key: ip, ...LOGIN_TRIES_PER_IP }) : true;
  if (!identifierAllowed || !ipAllowed) return { ok: false, reason: "too_many_requests" };

  const found = await findByIdentifier(typed);
  if (found && found.status === "suspended") {
    const [credential] = await getDb()
      .select({ hash: account.password })
      .from(account)
      .where(and(eq(account.userId, found.id), eq(account.providerId, "credential"), isNotNull(account.password)));
    const proved = credential?.hash ? await (await auth.$context).password.verify({ hash: credential.hash, password }) : false;
    return { ok: false, reason: proved ? "suspended" : "wrong" };
  }
  const usable = found && found.status === "active" ? found : null;
  try {
    await auth.api.signInEmail({ body: { email: usable?.email ?? NO_ACCOUNT_EMAIL, password }, headers });
    if (!usable) return { ok: false, reason: "wrong" };
    return { ok: true };
  } catch (error) {
    if (!isAPIError(error)) throw error;
    return { ok: false, reason: "wrong" };
  }
}

/** Whether the account has a password (a person who came through Google may not yet). */
export async function hasPassword(studentId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, studentId), eq(account.providerId, "credential"), isNotNull(account.password)));
  return row !== undefined;
}

export type SetPasswordResult = { ok: true } | { ok: false; message: string };

/** Sets the first password of the signed-in account. Refuses when one exists: changing it goes through a reset code. */
export async function setFirstPassword(password: string, headers: Headers): Promise<SetPasswordResult> {
  if (!passwordAcceptable(password)) return { ok: false, message: PASSWORD_RULE };
  try {
    await auth.api.setPassword({ body: { newPassword: password }, headers });
    return { ok: true };
  } catch (error) {
    if (!isAPIError(error)) throw error;
    return { ok: false, message: "A password is already set. Use Forgot password to change it." };
  }
}

/** Sends a reset code to the account's sign-in email. Answers the same when nothing matches. */
export async function requestPasswordReset(identifier: string, headers: Headers): Promise<CodeRequestResult> {
  const ip = clientIp(headers);
  if (ip && !(await consume({ action: "reset:ip", key: ip, ...RESET_LOOKUPS_PER_IP }))) {
    return { ok: false, reason: "too_many_requests" };
  }
  const found = await findByIdentifier(identifier);
  if (!found || found.status !== "active") return { ok: true };
  return requestPasswordResetCode(found.email, headers);
}

export type ResetResult = { ok: true } | { ok: false; reason: "bad_code" | "weak_password" | "too_many_requests" };

/** Sets a new password with the emailed code, ends every other session, and signs in. */
export async function resetPasswordWithCode(
  args: { identifier: string; code: string; password: string; headers: Headers },
): Promise<ResetResult> {
  if (!passwordAcceptable(args.password)) return { ok: false, reason: "weak_password" };
  const found = await findByIdentifier(args.identifier);
  if (!found || found.status !== "active") return { ok: false, reason: "bad_code" };
  try {
    await auth.api.resetPasswordEmailOTP({
      body: { email: found.email, otp: args.code, password: args.password },
      headers: args.headers,
    });
  } catch (error) {
    if (!isAPIError(error)) throw error;
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code === "TOO_MANY_REQUESTS") return { ok: false, reason: "too_many_requests" };
    return { ok: false, reason: "bad_code" };
  }
  await auth.api.signInEmail({ body: { email: found.email, password: args.password }, headers: args.headers });
  return { ok: true };
}
