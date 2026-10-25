import { describe, expect, it } from "vitest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("public search routes", () => {
  it("lets crawlers reach Login and lists it on the canonical domain", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://studiskarte.com");
    expect(urls).toContain("https://studiskarte.com/sign-in");
    expect(urls).toContain("https://studiskarte.com/sign-up");

    const rules = robots().rules;
    const universal = (Array.isArray(rules) ? rules : [rules]).find((rule) => rule.userAgent === "*");
    const blocked = universal && "disallow" in universal ? universal.disallow : [];
    expect(blocked).not.toContain("/sign-in");
    expect(blocked).toContain("/messages");
    expect(blocked).toContain("/partner/");
  });
});
