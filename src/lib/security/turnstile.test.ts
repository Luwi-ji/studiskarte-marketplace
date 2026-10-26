import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/identity/auth", () => ({ clientIp: () => "203.0.113.9" }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

async function configured() {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site-key");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret-key");
  return import("@/lib/security/turnstile");
}

describe("Turnstile server validation", () => {
  it("accepts a successful token only for the expected action", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, action: "signup" }), { status: 200 })));
    const { verifyTurnstile } = await configured();
    await expect(verifyTurnstile("token", "signup", new Headers())).resolves.toEqual({ ok: true });
    await expect(verifyTurnstile("token", "contact", new Headers())).resolves.toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects missing and oversized tokens without calling Cloudflare", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    const { verifyTurnstile } = await configured();
    await expect(verifyTurnstile("", "signup", new Headers())).resolves.toEqual({ ok: false, reason: "missing" });
    await expect(verifyTurnstile("x".repeat(2049), "signup", new Headers())).resolves.toEqual({ ok: false, reason: "missing" });
    expect(request).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { verifyTurnstile } = await configured();
    await expect(verifyTurnstile("token", "password_reset", new Headers())).resolves.toEqual({ ok: false, reason: "unavailable" });
  });
});
