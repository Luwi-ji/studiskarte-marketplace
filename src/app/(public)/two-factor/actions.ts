"use server";

import { eq } from "drizzle-orm";
import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { setAdminMfaCookie, safeMfaReturnTo } from "@/lib/identity/admin-mfa";
import { auth } from "@/lib/identity/auth";

export type TwoFactorState = { error?: string; method?: "totp" | "backup" };

const INVALID = "That code did not work. Check it and try again.";

export async function verifySecondFactor(_previous: TwoFactorState, formData: FormData): Promise<TwoFactorState> {
  const method = formData.get("method") === "backup" ? "backup" : "totp";
  const code = String(formData.get("code") ?? "").trim();
  if (method === "totp" && !/^\d{6}$/.test(code)) return { method, error: "Enter the 6-digit code." };
  if (method === "backup" && (code.length < 6 || code.length > 64)) return { method, error: INVALID };

  try {
    const requestHeaders = await headers();
    const result = method === "backup"
      ? await auth.api.verifyBackupCode({ body: { code, disableSession: false, trustDevice: false }, headers: requestHeaders })
      : await auth.api.verifyTOTP({ body: { code, trustDevice: false }, headers: requestHeaders });
    const [account] = await getDb().select({ admin: student.isAdmin }).from(student).where(eq(student.id, result.user.id));
    if (account?.admin) await setAdminMfaCookie(result.user.id);
    redirect(safeMfaReturnTo(formData.get("next")));
  } catch (error) {
    unstable_rethrow(error);
    if (isAPIError(error) && error.statusCode === 429) return { method, error: "Too many attempts. Wait 15 minutes and try again." };
    return { method, error: INVALID };
  }
}
