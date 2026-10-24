"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { auth, requestSignUpCode, SIGN_IN_ERROR, visitorsAllowed } from "@/lib/identity/auth";
import { withReturnTo } from "@/lib/identity/return-to";
import { parseRole, type Role } from "@/lib/identity/roles";
import { parseEmail } from "@/lib/identity/school-email";
import { signUpRoleProblem } from "@/lib/identity/sign-up-rules";

export type SignUpState =
  | { step: "email"; role: Role; email?: string; error?: string }
  | { step: "code"; role: Role; email: string; error?: string };

const VISITORS_CLOSED = "Sign-up with a personal email is not open yet. Use your school email.";
const TRY_LATER = "Too many attempts. Try again later.";
const COULD_NOT_SEND = "We could not send the code. Try again later.";
const EXISTS = "There is already an account for that email. Log in, or use Forgot password.";
// Wrong, expired, used and locked codes all get this one reply, so the
// response never reveals which condition applied.
const BAD_CODE = "That code did not work. Check it or ask for a new one.";

function roleOf(formData: FormData): Role {
  return parseRole(formData.get("role")) ?? "student";
}

export async function requestCode(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const role = roleOf(formData);
  const typed = String(formData.get("email") ?? "");
  const parsed = parseEmail(typed);
  if (!parsed) return { step: "email", role, email: typed, error: "Enter a valid email address." };
  const problem = signUpRoleProblem({ role, school: parsed.school, personalEmailOpen: visitorsAllowed() });
  if (problem) return { step: "email", role, email: typed, error: problem };

  try {
    const result = await requestSignUpCode(parsed.email, await headers());
    if (result.ok) return { step: "code", role, email: parsed.email };
    if (result.reason === "invalid_email") return { step: "email", role, email: typed, error: "Enter a valid email address." };
    if (result.reason === "visitors_closed") return { step: "email", role, email: typed, error: VISITORS_CLOSED };
    if (result.reason === "account_exists") return { step: "email", role, email: typed, error: EXISTS };
    if (result.reason === "send_failed") return { step: "email", role, email: typed, error: COULD_NOT_SEND };
    return { step: "email", role, email: typed, error: TRY_LATER };
  } catch (error) {
    console.error("requesting a sign-up code failed", error);
    return { step: "email", role, email: typed, error: COULD_NOT_SEND };
  }
}

/** The right code makes the account and signs it in; the password and profile come next on /welcome. */
export async function verifyCode(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const role = roleOf(formData);
  const email = parseEmail(String(formData.get("email") ?? ""))?.email ?? "";
  const otp = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(otp)) return { step: "code", role, email, error: BAD_CODE };

  try {
    await auth.api.signInEmailOTP({ body: { email, otp }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) {
      const code = (error.body as { code?: string } | undefined)?.code;
      if (code === SIGN_IN_ERROR.tooManyRequests) return { step: "code", role, email, error: TRY_LATER };
      if (code === SIGN_IN_ERROR.visitorsClosed) return { step: "code", role, email, error: VISITORS_CLOSED };
      return { step: "code", role, email, error: BAD_CODE };
    }
    console.error("sign-up failed", error);
    return { step: "code", role, email, error: "Something went wrong. Try again." };
  }
  // The chosen role is only a default on the next step; the account's own role is decided there and by its email.
  const welcome = withReturnTo("/welcome", formData.get("next"));
  redirect(`${welcome}${welcome.includes("?") ? "&" : "?"}role=${role}`);
}
