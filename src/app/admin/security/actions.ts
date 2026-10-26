"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { requireAdminAccount, requireRecentAdmin } from "@/lib/access";
import { setAdminMfaCookie } from "@/lib/identity/admin-mfa";
import { auth } from "@/lib/identity/auth";

export type EnrollmentResult =
  | { ok: true; totpURI: string; backupCodes: string[] }
  | { ok: false; error: string };
export type RecoveryResult = { ok: true; backupCodes: string[] } | { ok: false; error: string };
export type VerifyEnrollmentResult = { ok: true } | { ok: false; error: string };

const GENERIC = "Could not update two-factor security. Try again.";

export async function startAdminMfaEnrollment(password: unknown): Promise<EnrollmentResult> {
  try {
    const admin = await requireAdminAccount();
    if (admin.twoFactorEnabled) return { ok: false, error: "Two-factor authentication is already enabled." };
    if (typeof password !== "string" || password === "") return { ok: false, error: "Enter your current password." };
    const result = await auth.api.enableTwoFactor({ body: { password, method: "totp", issuer: "Studiskarte" }, headers: await headers() });
    if (result.method !== "totp") return { ok: false, error: GENERIC };
    return { ok: true, totpURI: result.totpURI, backupCodes: result.backupCodes };
  } catch (error) {
    unstable_rethrow(error);
    if (isAPIError(error)) return { ok: false, error: "The password did not match, or setup has expired." };
    console.error("starting admin MFA enrollment failed", error);
    return { ok: false, error: GENERIC };
  }
}

export async function verifyAdminMfaEnrollment(code: unknown): Promise<VerifyEnrollmentResult> {
  try {
    const admin = await requireAdminAccount();
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code." };
    const result = await auth.api.verifyTOTP({ body: { code, trustDevice: false }, headers: await headers() });
    if (result.user.id !== admin.id) return { ok: false, error: GENERIC };
    await setAdminMfaCookie(admin.id);
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (isAPIError(error)) return { ok: false, error: "That code did not work. Check your phone's time and try again." };
    console.error("verifying admin MFA enrollment failed", error);
    return { ok: false, error: GENERIC };
  }
}

export async function replaceAdminRecoveryCodes(password: unknown): Promise<RecoveryResult> {
  try {
    await requireRecentAdmin();
    if (typeof password !== "string" || password === "") return { ok: false, error: "Enter your current password." };
    const result = await auth.api.generateBackupCodes({ body: { password }, headers: await headers() });
    return { ok: true, backupCodes: result.backupCodes };
  } catch (error) {
    unstable_rethrow(error);
    if (isAPIError(error)) return { ok: false, error: "The password did not match." };
    console.error("replacing admin recovery codes failed", error);
    return { ok: false, error: GENERIC };
  }
}
