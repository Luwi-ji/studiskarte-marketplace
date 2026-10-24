"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { auth, requestSignUpCode, SIGN_IN_ERROR, visitorsAllowed } from "@/lib/identity/auth";
import { withReturnTo } from "@/lib/identity/return-to";
import { parseEmail } from "@/lib/identity/school-email";

export type Mode = "school" | "visitor";
export type SignUpState =
  | { step: "email"; mode: Mode; error?: string }
  | { step: "code"; mode: Mode; email: string; error?: string };

const SCHOOL_HINT = "Use your school email address ending in .edu.ph. No school email? Continue as a guest.";
const VISITOR_HINT = "That is a school email. Choose School email instead.";
const VISITORS_CLOSED = "Sign-up without a school email is not open yet. Use your school email.";
const TRY_LATER = "Too many attempts. Try again later.";
const COULD_NOT_SEND = "We could not send the code. Try again later.";
const EXISTS = "There is already an account for that email. Log in, or use Forgot password.";
// Wrong, expired, used and locked codes all get this one reply, so the
// response never reveals which condition applied.
const BAD_CODE = "That code did not work. Check it or ask for a new one.";

function modeOf(formData: FormData): Mode {
  return formData.get("mode") === "visitor" ? "visitor" : "school";
}

export async function requestCode(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const mode = modeOf(formData);
  const parsed = parseEmail(String(formData.get("email") ?? ""));
  if (!parsed) return { step: "email", mode, error: "Enter a valid email address." };
  if (mode === "school" && !parsed.school) return { step: "email", mode, error: SCHOOL_HINT };
  if (mode === "visitor" && parsed.school) return { step: "email", mode, error: VISITOR_HINT };
  if (!parsed.school && !visitorsAllowed()) return { step: "email", mode, error: VISITORS_CLOSED };

  try {
    const result = await requestSignUpCode(parsed.email, await headers());
    if (result.ok) return { step: "code", mode, email: parsed.email };
    if (result.reason === "invalid_email") return { step: "email", mode, error: "Enter a valid email address." };
    if (result.reason === "visitors_closed") return { step: "email", mode, error: VISITORS_CLOSED };
    if (result.reason === "account_exists") return { step: "email", mode, error: EXISTS };
    if (result.reason === "send_failed") return { step: "email", mode, error: COULD_NOT_SEND };
    return { step: "email", mode, error: TRY_LATER };
  } catch (error) {
    console.error("requesting a sign-up code failed", error);
    return { step: "email", mode, error: COULD_NOT_SEND };
  }
}

/** The right code makes the account and signs it in; the password and profile come next on /welcome. */
export async function verifyCode(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const mode = modeOf(formData);
  const email = parseEmail(String(formData.get("email") ?? ""))?.email ?? "";
  const otp = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(otp)) return { step: "code", mode, email, error: BAD_CODE };

  try {
    await auth.api.signInEmailOTP({ body: { email, otp }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) {
      const code = (error.body as { code?: string } | undefined)?.code;
      if (code === SIGN_IN_ERROR.tooManyRequests) return { step: "code", mode, email, error: TRY_LATER };
      if (code === SIGN_IN_ERROR.visitorsClosed) return { step: "code", mode, email, error: VISITORS_CLOSED };
      return { step: "code", mode, email, error: BAD_CODE };
    }
    console.error("sign-up failed", error);
    return { step: "code", mode, email, error: "Something went wrong. Try again." };
  }
  redirect(withReturnTo("/welcome", formData.get("next")));
}
