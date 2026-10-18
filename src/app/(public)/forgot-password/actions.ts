"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PASSWORD_RULE } from "@/lib/identity/password-rules";
import { requestPasswordReset, resetPasswordWithCode } from "@/lib/identity/password";

export type ResetState =
  | { step: "who"; error?: string }
  | { step: "code"; identifier: string; error?: string };

const TRY_LATER = "Too many attempts. Try again later.";
const COULD_NOT_SEND = "We could not send the code. Try again later.";
const BAD_CODE = "That code did not work. Check it or ask for a new one.";

/** Always moves on to the code step, whether or not an account matches, so it does not show which names exist. */
export async function requestReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (identifier === "") return { step: "who", error: "Enter your email or handle." };
  try {
    const result = await requestPasswordReset(identifier, await headers());
    if (result.ok) return { step: "code", identifier };
    if (result.reason === "send_failed") return { step: "who", error: COULD_NOT_SEND };
    return { step: "who", error: TRY_LATER };
  } catch (error) {
    console.error("requesting a password reset failed", error);
    return { step: "who", error: COULD_NOT_SEND };
  }
}

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const identifier = String(formData.get("identifier") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const password = String(formData.get("password") ?? "");
  if (!/^\d{6}$/.test(code)) return { step: "code", identifier, error: BAD_CODE };
  try {
    const result = await resetPasswordWithCode({ identifier, code, password, headers: await headers() });
    if (!result.ok) {
      const error = result.reason === "weak_password" ? PASSWORD_RULE : result.reason === "too_many_requests" ? TRY_LATER : BAD_CODE;
      return { step: "code", identifier, error };
    }
  } catch (error) {
    console.error("resetting a password failed", error);
    return { step: "code", identifier, error: "Something went wrong. Try again." };
  }
  redirect("/");
}
