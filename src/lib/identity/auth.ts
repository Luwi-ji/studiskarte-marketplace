import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { AsyncLocalStorage } from "node:async_hooks";
import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import * as schema from "@/db/schema";
import { getDb } from "@/lib/db";
import { MailQuotaError, sendMail } from "@/lib/mail";
import { consume } from "@/lib/rate-limit";
import { parseSchoolEmail } from "@/lib/identity/school-email";

/** Error codes the sign-in action maps to messages. */
export const SIGN_IN_ERROR = {
  notSchoolEmail: "NOT_SCHOOL_EMAIL",
  tooManyRequests: "TOO_MANY_REQUESTS",
} as const;

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
const OTP_LENGTH = 6;
const OTP_EXPIRES_SECONDS = 5 * 60;
const OTP_ALLOWED_ATTEMPTS = 3;

// Limits. Counted per address and per network address, because the endpoint
// is public. See ADR 0004 and the "Code request limits" rule.
const CODE_REQUESTS_PER_EMAIL = { max: 3, windowSeconds: 15 * 60 };
const CODE_REQUESTS_PER_IP = { max: 10, windowSeconds: 60 * 60 };
const SIGN_IN_TRIES_PER_EMAIL = { max: 10, windowSeconds: 60 * 60 };
const SIGN_IN_TRIES_PER_IP = { max: 30, windowSeconds: 60 * 60 };

const REQUEST_PATH = "/email-otp/send-verification-otp";
const VERIFY_PATH = "/sign-in/email-otp";

function notSchoolEmailError() {
  return APIError.from("BAD_REQUEST", {
    code: SIGN_IN_ERROR.notSchoolEmail,
    message: "Use your school email address ending in .edu.ph.",
  });
}

// Better Auth catches any error thrown by sendVerificationOTP, logs it, and
// still answers "success" (runInBackgroundOrAwait). The callback records the
// failure here, scoped to the current request, so the caller can tell.
const codeDelivery = new AsyncLocalStorage<{ error?: unknown }>();

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
  user: {
    additionalFields: {
      schoolDomain: { type: "string", required: false, input: false },
    },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] },
  },
  databaseHooks: {
    user: {
      create: {
        // Last line of defence: no student row exists for a non-school address,
        // whatever path led here.
        before: async (user) => {
          const school = parseSchoolEmail(user.email);
          if (!school) {
            throw notSchoolEmailError();
          }
          // The student row references its school, so make sure the school exists.
          await getDb()
            .insert(schema.school)
            .values({ domain: school.domain })
            .onConflictDoNothing();
          return { data: { ...user, email: school.email, schoolDomain: school.domain } };
        },
      },
    },
  },
  hooks: {
    // Runs before Better Auth creates or rotates a code, so a refused request
    // cannot invalidate someone else's live code or leave a code behind.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== REQUEST_PATH && ctx.path !== VERIFY_PATH) return;

      const rawEmail = (ctx.body as { email?: unknown } | undefined)?.email;
      const school = typeof rawEmail === "string" ? parseSchoolEmail(rawEmail) : null;
      if (!school) {
        throw notSchoolEmailError();
      }

      const ip = ctx.headers ? getIP(ctx.headers, ctx.context.options) : null;
      const [perEmail, perIp] =
        ctx.path === REQUEST_PATH
          ? [CODE_REQUESTS_PER_EMAIL, CODE_REQUESTS_PER_IP]
          : [SIGN_IN_TRIES_PER_EMAIL, SIGN_IN_TRIES_PER_IP];
      const action = ctx.path === REQUEST_PATH ? "otp_request" : "otp_verify";

      const emailAllowed = await consume({ action: `${action}:email`, key: school.email, ...perEmail });
      // Without an address we cannot key the network limit; a shared "unknown"
      // bucket would lock everyone out together.
      const ipAllowed = ip ? await consume({ action: `${action}:ip`, key: ip, ...perIp }) : true;
      if (!emailAllowed || !ipAllowed) {
        throw APIError.from("TOO_MANY_REQUESTS", {
          code: SIGN_IN_ERROR.tooManyRequests,
          message: "Too many attempts. Try again later.",
        });
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
        // Only sign-in codes are ever sent. The same rule is re-checked here
        // because this function is the only way mail can leave for a code.
        if (type !== "sign-in") {
          throw APIError.fromStatus("BAD_REQUEST", { message: "Unsupported code type" });
        }
        const school = parseSchoolEmail(email);
        if (!school) {
          throw notSchoolEmailError();
        }
        try {
          await sendMail({
            to: school.email,
            subject: "Your Studiskarte code",
            text: `Your Studiskarte Marketplace code is ${otp}.\nIt expires in ${OTP_EXPIRES_SECONDS / 60} minutes. If you did not ask for it, ignore this message.`,
          });
        } catch (error) {
          // Better Auth catches this and still answers "success"; see requestSignInCode.
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

export const auth = betterAuth(authOptions);

export type CodeRequestResult =
  | { ok: true }
  | { ok: false; reason: "not_school_email" | "too_many_requests" | "mail_quota" | "send_failed" };

/**
 * Asks for a sign-in code and reports whether the mail really left. The UI
 * must never say "we sent a code" when it did not.
 */
export async function requestSignInCode(email: string, headers: Headers): Promise<CodeRequestResult> {
  const outcome: { error?: unknown } = {};
  try {
    await codeDelivery.run(outcome, () =>
      auth.api.sendVerificationOTP({ body: { email, type: "sign-in" }, headers }),
    );
  } catch (error) {
    const code = isAPIError(error) ? (error.body as { code?: string } | undefined)?.code : undefined;
    if (code === SIGN_IN_ERROR.notSchoolEmail) return { ok: false, reason: "not_school_email" };
    if (code === SIGN_IN_ERROR.tooManyRequests) return { ok: false, reason: "too_many_requests" };
    throw error;
  }
  if (outcome.error instanceof MailQuotaError) return { ok: false, reason: "mail_quota" };
  if (outcome.error) {
    console.error("sending a sign-in code failed", outcome.error);
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true };
}
