import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent } from "@/lib/sentry-options";

describe("scrubEvent", () => {
  it("hides a shop's report token wherever the link can appear", () => {
    const link = "/partner/AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    const event = {
      request: { url: `https://studiskarte.com${link}` },
      transaction: `GET ${link}`,
      message: `Failed on ${link}`,
      exception: { values: [{ value: `Not found: ${link}` }] },
      breadcrumbs: [{ message: `navigate ${link}` }],
    } as unknown as ErrorEvent;
    const clean = scrubEvent(event);
    expect(clean.request?.url).toBe("https://studiskarte.com/partner/[token]");
    expect(clean.transaction).toBe("GET /partner/[token]");
    expect(clean.message).toBe("Failed on /partner/[token]");
    expect(clean.exception?.values?.[0].value).toBe("Not found: /partner/[token]");
    expect(clean.breadcrumbs?.[0].message).toBe("navigate /partner/[token]");
  });

  it("removes identity, cookies, headers, bodies and query strings", () => {
    const event = {
      user: { id: "u1", email: "ana@school.edu.ph", ip_address: "1.2.3.4" },
      request: {
        url: "https://studiskarte.com/posts/1",
        cookies: { session: "secret" },
        headers: { cookie: "session=secret" },
        data: { password: "hunter2" },
        query_string: "email=ana@school.edu.ph",
      },
    } as unknown as ErrorEvent;

    const clean = scrubEvent(event);

    expect(clean.user).toBeUndefined();
    expect(clean.request).toEqual({ url: "https://studiskarte.com/posts/1" });
  });

  it("blanks email addresses in messages, exception text and breadcrumbs, and drops breadcrumb data", () => {
    const event = {
      message: "Could not send to ana.reyes+tag@tup.edu.ph",
      exception: { values: [{ value: "Bounce for ben@gmail.com and ana@tup.edu.ph" }] },
      breadcrumbs: [{ message: "reset for cam@school.edu.ph", data: { to: "cam@school.edu.ph" } }],
    } as unknown as ErrorEvent;

    const clean = scrubEvent(event);

    expect(clean.message).toBe("Could not send to [email]");
    expect(clean.exception?.values?.[0].value).toBe("Bounce for [email] and [email]");
    expect(clean.breadcrumbs?.[0]).toEqual({ message: "reset for [email]" });
  });

  it("leaves an event with nothing personal as it was", () => {
    const event = { message: "Database connection reset", exception: { values: [{ value: "ECONNRESET" }] } } as unknown as ErrorEvent;
    expect(scrubEvent(event)).toEqual({ message: "Database connection reset", exception: { values: [{ value: "ECONNRESET" }] } });
  });
});
