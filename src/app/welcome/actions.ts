"use server";

import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { completeSignUp } from "@/lib/identity/profile";

export type WelcomeState = {
  values: { handle: string; displayName: string };
  error?: { field: "handle" | "displayName"; message: string };
};

export async function finishSignUp(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const values = {
    handle: String(formData.get("handle") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  if (me.handle) redirect("/");

  const result = await completeSignUp(me.id, values);
  if (!result.ok) return { values, error: { field: result.field, message: result.message } };
  redirect("/");
}
