import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createR2Store, SIGNING_WINDOW_SECONDS } from "./store";

// Signing is local arithmetic: no request is made, so dummy credentials do.
function signed(key: string, ttl: number, store = createR2Store()) {
  return store.signedUrl(key, ttl).then((url) => new URL(url));
}

describe("signed picture links", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("R2_BUCKET", "test-bucket");
    vi.stubEnv("R2_ACCOUNT_ID", "0123456789abcdef");
    vi.stubEnv("R2_ACCESS_KEY_ID", "AKIATEST");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("is the same address when asked again within the window, so a refreshing page keeps its images", async () => {
    vi.setSystemTime(new Date("2026-10-16T10:00:10Z"));
    const first = await signed("messages/a.webp", 1800);
    vi.setSystemTime(new Date("2026-10-16T10:04:50Z"));
    const second = await signed("messages/a.webp", 1800);
    expect(second.href).toBe(first.href);
  });

  it("changes in the next window, and differs per photo", async () => {
    vi.setSystemTime(new Date("2026-10-16T10:04:59Z"));
    const early = await signed("messages/a.webp", 1800);
    vi.setSystemTime(new Date("2026-10-16T10:05:01Z"));
    const later = await signed("messages/a.webp", 1800);
    expect(later.href).not.toBe(early.href);
    expect((await signed("messages/b.webp", 1800)).href).not.toBe(later.href);
  });

  it("never expires sooner than asked, even at the end of a window", async () => {
    const now = new Date("2026-10-16T10:04:59Z");
    vi.setSystemTime(now);
    const url = await signed("messages/a.webp", 1800);
    const date = url.searchParams.get("X-Amz-Date") ?? "";
    const startedAt = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`);
    const expiresAt = startedAt + Number(url.searchParams.get("X-Amz-Expires")) * 1000;
    expect(expiresAt - now.getTime()).toBeGreaterThanOrEqual(1800 * 1000);
    expect(expiresAt - now.getTime()).toBeLessThanOrEqual((1800 + SIGNING_WINDOW_SECONDS) * 1000);
  });
});
