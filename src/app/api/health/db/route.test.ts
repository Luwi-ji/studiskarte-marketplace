import type * as NextServerModule from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  connection: vi.fn(async () => undefined),
  query: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof NextServerModule>();
  return { ...actual, connection: mocks.connection };
});
vi.mock("@/lib/db", () => ({ getPool: () => ({ query: mocks.query }) }));

const get = (url = "https://studiskarte.test/api/health/db") => GET(new Request(url));

describe("database health endpoint", () => {
  let now = new Date("2030-01-01T00:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    now += 20_000;
    vi.setSystemTime(now);
    mocks.connection.mockClear();
    mocks.query.mockReset();
  });

  afterAll(() => vi.useRealTimers());

  it("shares a short successful check and lets the CDN absorb repeated requests", async () => {
    mocks.query.mockResolvedValue({});

    const [first, second] = await Promise.all([get(), get()]);

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });
    expect(first.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=15, stale-while-revalidate=30");
  });

  it("refuses cache-busting query strings without touching the database", async () => {
    const response = await get("https://studiskarte.test/api/health/db?bust=1");

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("does not cache a failed check at the CDN", async () => {
    mocks.query.mockRejectedValue(new Error("unavailable"));

    const response = await get();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
