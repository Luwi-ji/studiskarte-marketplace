import { randomUUID } from "node:crypto";
import { clientIp } from "@/lib/identity/auth";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_FIELD = "cf-turnstile-response";
export type TurnstileAction = "signup" | "password_reset" | "contact";

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type TurnstileResult = { ok: true } | { ok: false; reason: "missing" | "invalid" | "unavailable" | "misconfigured" };

/** Turnstile tokens are five-minute, single-use credentials and must always be checked on the server. */
export async function verifyTurnstile(token: unknown, action: TurnstileAction, requestHeaders: Headers): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !turnstileSiteKey) {
    // Local development remains usable without Cloudflare. Preview and production fail closed.
    if (process.env.NODE_ENV !== "production") return { ok: true };
    console.error("Turnstile environment variables are not configured");
    return { ok: false, reason: "misconfigured" };
  }
  if (typeof token !== "string" || token.length < 1 || token.length > 2048) return { ok: false, reason: "missing" };

  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: clientIp(requestHeaders) ?? undefined,
        idempotency_key: randomUUID(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const result = (await response.json()) as { success?: boolean; action?: string };
    return result.success === true && result.action === action ? { ok: true } : { ok: false, reason: "invalid" };
  } catch (error) {
    console.error("Turnstile verification failed", error instanceof Error ? error.name : "unknown error");
    return { ok: false, reason: "unavailable" };
  }
}

export function turnstileMessage(result: Exclude<TurnstileResult, { ok: true }>): string {
  return result.reason === "unavailable" || result.reason === "misconfigured"
    ? "The security check is unavailable. Try again in a moment."
    : "Complete the security check and try again.";
}
