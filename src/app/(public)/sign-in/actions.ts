"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, googleEnabled } from "@/lib/identity/auth";
import { loginWithPassword } from "@/lib/identity/password";
import { safeReturnTo, withReturnTo } from "@/lib/identity/return-to";

export type SignInState = { error?: string; identifier?: string };

const WRONG =
  "Wrong email, handle or password. If you signed up with a code or with Google and never chose a password, use Forgot password.";
const TRY_LATER = "Too many attempts. Try again later.";
const SUSPENDED = "Your account is suspended. If you think this is a mistake, write to support@studiskarte.com from your account email and say what happened.";

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const identifier = String(formData.get("identifier") ?? "");
  const password = String(formData.get("password") ?? "");
  const result = await loginWithPassword(identifier, password, await headers());
  if (!result.ok) return { identifier, error: result.reason === "too_many_requests" ? TRY_LATER : result.reason === "suspended" ? SUSPENDED : WRONG };
  // The role was chosen when the account was made and decides what it can do, so signing in does not ask.
  redirect(safeReturnTo(formData.get("next")) ?? "/");
}

/** Starts Google sign-in: the person leaves for Google and comes back to /api/auth/callback/google. */
export async function continueWithGoogle(formData: FormData): Promise<void> {
  const next = safeReturnTo(formData.get("next")) ?? "/";
  if (!googleEnabled) redirect("/sign-in");
  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: next,
      newUserCallbackURL: withReturnTo("/welcome", next === "/" ? null : next),
      errorCallbackURL: "/sign-in?google=failed",
    },
    headers: await headers(),
  });
  redirect(result.url ?? "/sign-in?google=failed");
}

/** Ends the session. The caller reloads the page so no signed-in screen stays in memory. */
export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
}
