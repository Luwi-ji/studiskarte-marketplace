"use server";

import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { completeSignUp } from "@/lib/identity/profile";

export type WelcomeState = {
  values: { handle: string; displayName: string };
  error?: { field: "handle" | "displayName" | "terms"; message: string };
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
  const result = await completeSignUp(me.id, { ...values, acceptedTermsVersion: typeof shown === "string" ? shown : null });
  if (!result.ok) return { values, error: { field: result.field, message: result.message } };
  redirect("/");
}
