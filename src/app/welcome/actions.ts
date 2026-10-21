"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { completeSignUp } from "@/lib/identity/profile";
import { setFirstPassword } from "@/lib/identity/password";
import { parseSchoolRole } from "@/lib/identity/roles";

export type WelcomeState = {
  values: { handle: string; displayName: string };
  error?: { field: "handle" | "displayName" | "terms" | "age"; message: string };
};

export async function finishSignUp(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const values = {
    handle: String(formData.get("handle") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  if (me.handle) redirect("/");

  // The box carries the version that was on screen; the server checks it is still the current one.
  const shown = formData.get("terms");
  const result = await completeSignUp(me.id, {
    ...values,
    role: parseSchoolRole(formData.get("role")),
    acceptedTermsVersion: typeof shown === "string" ? shown : null,
    ageConfirmed: formData.get("age") === "on",
  });
  if (!result.ok) return { values, error: { field: result.field, message: result.message } };
  redirect("/");
}

export type PasswordState = { error?: string };

/** The first step after a code or Google: choose the password the account logs in with. */
export async function choosePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords are not the same." };
  const result = await setFirstPassword(password, await headers());
  if (!result.ok) return { error: result.message };
  redirect("/welcome");
}
