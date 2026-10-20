"use server";

import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { acceptTerms } from "@/lib/identity/terms";

export type AcceptState = { error?: string };

/** Records that the signed-in student accepted the version they were shown. */
export async function acceptTermsAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  const shown = formData.get("terms");
  const result = await acceptTerms(me.id, typeof shown === "string" ? shown : "", formData.get("adult") === "on");
  if (!result.ok) return { error: result.error };
  redirect("/");
}
