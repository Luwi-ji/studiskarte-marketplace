import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";

afterEach(() => vi.restoreAllMocks());

describe("CSP report collection", () => {
  it("logs directives and origins without URL paths or queries", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await POST(new Request("https://studiskarte.com/api/csp-report", {
      method: "POST",
      body: JSON.stringify({ "csp-report": {
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://bad.example/private/token?secret=yes",
        "document-uri": "https://studiskarte.com/messages/sensitive-id",
      } }),
    }));
    expect(response.status).toBe(204);
    expect(warning).toHaveBeenCalledWith("csp violation", {
      directive: "script-src-elem",
      blockedOrigin: "https://bad.example",
      documentOrigin: "https://studiskarte.com",
      disposition: "report",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret=yes");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("sensitive-id");
  });

  it("rejects oversized reports", async () => {
    const response = await POST(new Request("https://studiskarte.com/api/csp-report", {
      method: "POST",
      body: "x".repeat(16_385),
    }));
    expect(response.status).toBe(413);
  });
});
