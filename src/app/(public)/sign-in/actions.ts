"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAPIError } from "better-auth/api";
import { auth, SIGN_IN_ERROR } from "@/lib/identity/auth";
import { MailQuotaError } from "@/lib/mail";
import { parseSchoolEmail } from "@/lib/identity/school-email";

export type SignInState =
  | { step: "email"; error?: string }
  | { step: "code"; email: string; error?: string };

const SCHOOL_HINT = "Use your school email address ending in .edu.ph.";
const TRY_LATER = "Too many attempts. Try again later.";
// Wrong, expired, used and locked codes all get this one reply, so the
// response never reveals which condition applied.
const BAD_CODE = "That code did not work. Check it or ask for a new one.";

export async function requestCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const school = parseSchoolEmail(String(formData.get("email") ?? ""));
  if (!school) return { step: "email", error: SCHOOL_HINT };

  try {
    await auth.api.sendVerificationOTP({
      body: { email: school.email, type: "sign-in" },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof MailQuotaError) return { step: "email", error: TRY_LATER };
    if (isAPIError(error)) {
      const code = (error.body as { code?: string } | undefined)?.code;
      if (code === SIGN_IN_ERROR.notSchoolEmail) return { step: "email", error: SCHOOL_HINT };
      if (code === SIGN_IN_ERROR.tooManyRequests) return { step: "email", error: TRY_LATER };
    }
    console.error("sending a sign-in code failed", error);
    return { step: "email", error: "We could not send the code. Try again later." };
  }
  return { step: "code", email: school.email };
}

export async function verifyCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = parseSchoolEmail(String(formData.get("email") ?? ""))?.email ?? "";
  const otp = String(formData.get("code") ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(otp)) return { step: "code", email, error: BAD_CODE };

  try {
    await auth.api.signInEmailOTP({ body: { email, otp }, headers: await headers() });
  } catch (error) {
    if (isAPIError(error)) {
      const code = (error.body as { code?: string } | undefined)?.code;
      if (code === SIGN_IN_ERROR.tooManyRequests) return { step: "code", email, error: TRY_LATER };
      return { step: "code", email, error: BAD_CODE };
    }
    console.error("sign-in failed", error);
    return { step: "code", email, error: "Something went wrong. Try again." };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
