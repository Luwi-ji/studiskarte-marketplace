import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function run(url: string, cookie?: string) {
  return proxy(new NextRequest(url, { headers: cookie ? { cookie } : {} }));
}

describe("proxy on /", () => {
  it("shows the landing page to a visitor with no cookie", () => {
    const response = run("https://studiskarte.com/");
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://studiskarte.com/landing");
  });

  it.each(["better-auth.session_token=abc", "__Secure-better-auth.session_token=abc"])("lets %s through to the feed", (cookie) => {
    const response = run("https://studiskarte.com/", cookie);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("ignores unrelated cookies", () => {
    expect(run("https://studiskarte.com/", "theme=dark").headers.get("x-middleware-rewrite")).toBe("https://studiskarte.com/landing");
  });

  it("rewrites a tagged visit too", () => {
    expect(run("https://studiskarte.com/?utm_source=ig").headers.get("x-middleware-rewrite")).toBe("https://studiskarte.com/landing");
  });
});
