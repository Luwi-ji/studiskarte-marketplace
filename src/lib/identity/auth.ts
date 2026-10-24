import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { AsyncLocalStorage } from "node:async_hooks";
import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { MailQuotaError, sendMail } from "@/lib/mail";
import { consume, SIGN_UP_CODE_ACTION, SIGN_UP_CODES_PER_DAY } from "@/lib/rate-limit";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/identity/password-rules";
import { parseEmail, parseSchoolEmail } from "@/lib/identity/school-email";

/** Error codes the sign-in action maps to messages. */
export const SIGN_IN_ERROR = {
  invalidEmail: "INVALID_EMAIL",
  visitorsClosed: "VISITORS_CLOSED",
  tooManyRequests: "TOO_MANY_REQUESTS",
  signupsBusy: "SIGNUPS_BUSY",
} as const;

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const OTP_LENGTH = 6;
const OTP_EXPIRES_SECONDS = 5 * 60;
const OTP_ALLOWED_ATTEMPTS = 3;

// Limits. Counted per address and per network address, because the endpoints
// are public. See ADR 0004 and ADR 0005.
const CODE_REQUESTS_PER_EMAIL = { max: 3, windowSeconds: 15 * 60 };
const CODE_REQUESTS_PER_IP = { max: 10, windowSeconds: 60 * 60 };
const CODE_TRIES_PER_EMAIL = { max: 10, windowSeconds: 60 * 60 };
const CODE_TRIES_PER_IP = { max: 30, windowSeconds: 60 * 60 };

// Endpoints that send a code, and endpoints that check one.
const SIGN_UP_REQUEST_PATH = "/email-otp/send-verification-otp";
const SIGN_UP_VERIFY_PATH = "/sign-in/email-otp";
const RESET_REQUEST_PATH = "/email-otp/request-password-reset";
const RESET_VERIFY_PATH = "/email-otp/reset-password";
const REQUEST_PATHS = [SIGN_UP_REQUEST_PATH, RESET_REQUEST_PATH];
const VERIFY_PATHS = [SIGN_UP_VERIFY_PATH, RESET_VERIFY_PATH];

/**
 * Visitors (an address that is not a school address) may sign up only when ALLOW_VISITORS=true. The rules
 * that limit what a visitor may do (docs/roles-and-verification-plan.md) and the mail-provider switch must
 * exist before the owner turns it on.
 */
export function visitorsAllowed(): boolean {
  return process.env.ALLOW_VISITORS === "true";
}

function visitorsClosedError() {
  return APIError.from("BAD_REQUEST", {
    code: SIGN_IN_ERROR.visitorsClosed,
    message: "Sign-up without a school email is not open yet.",
  });
}

function invalidEmailError() {
  return APIError.from("BAD_REQUEST", {
    code: SIGN_IN_ERROR.invalidEmail,
    message: "That does not look like an email address.",
  });
}

// Better Auth catches any error thrown by sendVerificationOTP, logs it, and
// still answers "success" (runInBackgroundOrAwait). The callback records the
// failure here, scoped to the current request, so the caller can tell. The
// before hook records here that an account already exists for the address.
const codeDelivery = new AsyncLocalStorage<{ error?: unknown; exists?: boolean }>();

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : null;

/** Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET; without them its button is hidden. */
export const googleEnabled = google !== null;

const authOptions = {
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: schema.student,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  session: { expiresIn: SESSION_SECONDS, updateAge: 24 * 60 * 60 },
  emailAndPassword: {
    enabled: true,
    // Accounts are made only by the emailed code (or Google); the password is set afterwards.
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
    revokeSessionsOnPasswordReset: true,
  },
  socialProviders: google ? { google } : {},
  account: {
    // Google vouches for the address, and so did the code that made the account:
    // the same address means the same person.
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  user: {
    additionalFields: {
      schoolDomain: { type: "string", required: false, input: false },
      schoolEmail: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
    },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  databaseHooks: {
    user: {
      create: {
        // Last line of defence: every new account is an address we verified, and
        // its role follows from the address, whatever path led here.
        before: async (user) => {
          const parsed = parseEmail(user.email);
          if (!parsed || !user.emailVerified) throw invalidEmailError();
          // Names and pictures come from our own forms, never from Google.
          const base = { ...user, email: parsed.email, name: "", image: null };
          const school = parseSchoolEmail(parsed.email);
          if (!school) {
            if (!visitorsAllowed()) throw visitorsClosedError();
            return { data: { ...base, schoolDomain: null, schoolEmail: null, role: "visitor" } };
          }
          // The student row references its school, so make sure the school exists.
          await getDb()
            .insert(schema.school)
            .values({ domain: school.domain })
            .onConflictDoNothing();
          return { data: { ...base, schoolDomain: school.domain, schoolEmail: school.email, role: "student" } };
        },
      },
    },
  },
  hooks: {
    // Runs before Better Auth creates or rotates a code, so a refused request
    // cannot invalidate someone else's live code or leave a code behind.
    before: createAuthMiddleware(async (ctx) => {
      const isRequest = REQUEST_PATHS.includes(ctx.path);
      if (!isRequest && !VERIFY_PATHS.includes(ctx.path)) return;

      const rawEmail = (ctx.body as { email?: unknown } | undefined)?.email;
      const parsed = typeof rawEmail === "string" ? parseEmail(rawEmail) : null;
      if (!parsed) {
        throw invalidEmailError();
      }

      if ((ctx.path === SIGN_UP_REQUEST_PATH || ctx.path === SIGN_UP_VERIFY_PATH) && !parsed.school && !visitorsAllowed()) {
        throw visitorsClosedError();
      }

      const ip = ctx.headers ? getIP(ctx.headers, ctx.context.options) : null;
      const [perEmail, perIp] = isRequest
        ? [CODE_REQUESTS_PER_EMAIL, CODE_REQUESTS_PER_IP]
        : [CODE_TRIES_PER_EMAIL, CODE_TRIES_PER_IP];
      const action = `code:${ctx.path}`;

      const emailAllowed = await consume({ action: `${action}:email`, key: parsed.email, ...perEmail });
      // Without an address we cannot key the network limit; a shared "unknown"
      // bucket would lock everyone out together.
      const ipAllowed = ip ? await consume({ action: `${action}:ip`, key: ip, ...perIp }) : true;
      if (!emailAllowed || !ipAllowed) {
        throw APIError.from("TOO_MANY_REQUESTS", {
          code: SIGN_IN_ERROR.tooManyRequests,
          message: "Too many attempts. Try again later.",
        });
      }

      const [existing] = await getDb()
        .select({ status: schema.student.accountStatus })
        .from(schema.student)
        .where(eq(schema.student.email, parsed.email));

      // The sign-up code only ever makes a new account: it is never a way to sign
      // in to an existing one (that takes the password, or a reset). Nothing is
      // sent, and the caller is told.
      if (ctx.path === SIGN_UP_REQUEST_PATH && existing) {
        const outcome = codeDelivery.getStore();
        if (outcome) outcome.exists = true;
        return ctx.json({ success: true });
      }
      if (ctx.path === SIGN_UP_VERIFY_PATH && existing) {
        throw APIError.from("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
      }
      // New accounts share a daily share of the mail budget, so a burst of sign-ups cannot use up the day's mail and
      // leave password resets and support messages with none. Counted only when a code is really about to be sent.
      if (ctx.path === SIGN_UP_REQUEST_PATH && !existing) {
        const open = await consume({ action: SIGN_UP_CODE_ACTION, key: "global", max: SIGN_UP_CODES_PER_DAY, windowSeconds: 24 * 60 * 60 });
        if (!open) {
          throw APIError.from("TOO_MANY_REQUESTS", { code: SIGN_IN_ERROR.signupsBusy, message: "Sign-ups are busy right now. Try again tomorrow." });
        }
      }
      // A suspended or deleted account cannot reset its password. The answer
      // matches what an unknown address gets (a request looks accepted, a code
      // looks wrong), so it does not reveal the account's state, and no mail leaves.
      if (existing && existing.status !== "active") {
        if (ctx.path === RESET_REQUEST_PATH) return ctx.json({ success: true });
        if (ctx.path === RESET_VERIFY_PATH) {
          throw APIError.from("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
        }
      }
    }),
  },
  plugins: [
    emailOTP({
      otpLength: OTP_LENGTH,
      expiresIn: OTP_EXPIRES_SECONDS,
      allowedAttempts: OTP_ALLOWED_ATTEMPTS,
      resendStrategy: "rotate",
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp, type }) {
        // Only these two codes are ever sent. The address rule is re-checked here
        // because this function is the only way mail can leave for a code.
        if (type !== "sign-in" && type !== "forget-password") {
          throw APIError.fromStatus("BAD_REQUEST", { message: "Unsupported code type" });
        }
        const parsed = parseEmail(email);
        if (!parsed) {
          throw invalidEmailError();
        }
        const minutes = OTP_EXPIRES_SECONDS / 60;
        const text =
          type === "sign-in"
            ? `Your Studiskarte Marketplace code is ${otp}.\nIt expires in ${minutes} minutes. If you did not ask for it, ignore this message.`
            : `Your Studiskarte Marketplace password reset code is ${otp}.\nIt expires in ${minutes} minutes. If you did not ask for it, ignore this message: your password has not changed.`;
        try {
          await sendMail({
            to: parsed.email,
            subject: type === "sign-in" ? "Your Studiskarte code" : "Your Studiskarte password reset code",
            text,
          });
        } catch (error) {
          // Better Auth catches this and still answers "success"; see sendCode.
          const outcome = codeDelivery.getStore();
          if (outcome) outcome.error = error;
          throw error;
        }
      },
    }),
    // Must be last: lets server actions set the session cookie.
    nextCookies(),
  ],
} satisfies Parameters<typeof betterAuth>[0];

/** The caller's network address as Better Auth reads it (null when no header carries one). */
export function clientIp(headers: Headers): string | null {
  return getIP(headers, authOptions);
}

export const auth = betterAuth(authOptions);

export type CodeRequestResult =
  | { ok: true }
  | { ok: false; reason: "invalid_email" | "visitors_closed" | "account_exists" | "too_many_requests" | "signups_busy" | "mail_quota" | "send_failed" };

/** Runs a code-sending call and reports whether the mail really left. The UI must never say "we sent a code" when it did not. */
async function sendCode(send: () => Promise<unknown>): Promise<CodeRequestResult> {
  const outcome: { error?: unknown; exists?: boolean } = {};
  try {
    await codeDelivery.run(outcome, send);
  } catch (error) {
    const code = isAPIError(error) ? (error.body as { code?: string } | undefined)?.code : undefined;
    if (code === SIGN_IN_ERROR.invalidEmail) return { ok: false, reason: "invalid_email" };
    if (code === SIGN_IN_ERROR.visitorsClosed) return { ok: false, reason: "visitors_closed" };
    if (code === SIGN_IN_ERROR.tooManyRequests) return { ok: false, reason: "too_many_requests" };
    if (code === SIGN_IN_ERROR.signupsBusy) return { ok: false, reason: "signups_busy" };
    throw error;
  }
  if (outcome.exists) return { ok: false, reason: "account_exists" };
  if (outcome.error instanceof MailQuotaError) return { ok: false, reason: "mail_quota" };
  if (outcome.error) {
    console.error("sending a code failed", outcome.error);
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true };
}

/** Asks for the code that proves the address and makes the account. Refuses an address that already has an account. */
export function requestSignUpCode(email: string, headers: Headers): Promise<CodeRequestResult> {
  return sendCode(() => auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers }));
}

/** Asks for a password reset code. Answers the same for an address with no account (nothing is sent). */
export function requestPasswordResetCode(email: string, headers: Headers): Promise<CodeRequestResult> {
  return sendCode(() => auth.api.requestPasswordResetEmailOTP({ body: { email }, headers }));
}
