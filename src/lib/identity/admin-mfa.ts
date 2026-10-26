import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { safeReturnTo } from "@/lib/identity/return-to";

const COOKIE = "studiskarte.admin_mfa";
export const ADMIN_MFA_MAX_AGE_SECONDS = 12 * 60 * 60;
export const SENSITIVE_MFA_MAX_AGE_SECONDS = 15 * 60;

type Proof = { userId: string; verifiedAt: number };

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET must be set");
  return value;
}

function signature(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createAdminMfaProof(userId: string, verifiedAt = Date.now(), key = secret()): string {
  const payload = Buffer.from(JSON.stringify({ userId, verifiedAt } satisfies Proof)).toString("base64url");
  return `${payload}.${signature(payload, key)}`;
}

export function verifyAdminMfaProof(value: string, userId: string, maxAgeSeconds: number, now = Date.now(), key = secret()): boolean {
  const dot = value.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = value.slice(0, dot);
  const supplied = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(signature(payload, key));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<Proof>;
    if (claim.userId !== userId || typeof claim.verifiedAt !== "number") return false;
    const age = now - claim.verifiedAt;
    return age >= -60_000 && age <= maxAgeSeconds * 1000;
  } catch {
    return false;
  }
}

export async function setAdminMfaCookie(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, createAdminMfaProof(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_MFA_MAX_AGE_SECONDS,
  });
}

export async function clearAdminMfaCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function hasRecentAdminMfa(userId: string, maxAgeSeconds = ADMIN_MFA_MAX_AGE_SECONDS): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value ? verifyAdminMfaProof(value, userId, maxAgeSeconds) : false;
}

/** A second-factor flow may return only inside this site. */
export function safeMfaReturnTo(value: unknown): string {
  if (value === "/" || value === "/admin" || (typeof value === "string" && /^\/admin\/[a-z0-9/_-]*$/i.test(value))) return value;
  return safeReturnTo(value) ?? "/";
}
