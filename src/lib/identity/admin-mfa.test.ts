import { describe, expect, it } from "vitest";
import { createAdminMfaProof, safeMfaReturnTo, verifyAdminMfaProof } from "@/lib/identity/admin-mfa";

const key = "test-secret-that-is-not-used-outside-this-file";
const now = Date.UTC(2026, 9, 25, 12);

describe("administrator MFA assurance", () => {
  it("accepts a valid proof only for its administrator and lifetime", () => {
    const proof = createAdminMfaProof("admin-1", now - 5 * 60_000, key);
    expect(verifyAdminMfaProof(proof, "admin-1", 15 * 60, now, key)).toBe(true);
    expect(verifyAdminMfaProof(proof, "admin-2", 15 * 60, now, key)).toBe(false);
    expect(verifyAdminMfaProof(proof, "admin-1", 4 * 60, now, key)).toBe(false);
  });

  it("rejects changed, malformed, and implausibly future proofs", () => {
    const proof = createAdminMfaProof("admin-1", now, key);
    expect(verifyAdminMfaProof(`${proof.slice(0, -1)}x`, "admin-1", 900, now, key)).toBe(false);
    expect(verifyAdminMfaProof("not-a-proof", "admin-1", 900, now, key)).toBe(false);
    expect(verifyAdminMfaProof(createAdminMfaProof("admin-1", now + 61_000, key), "admin-1", 900, now, key)).toBe(false);
  });

  it("returns only to local admin destinations", () => {
    expect(safeMfaReturnTo("/admin/verifications")).toBe("/admin/verifications");
    expect(safeMfaReturnTo("https://attacker.example/admin")).toBe("/");
    expect(safeMfaReturnTo("//attacker.example")).toBe("/");
  });
});
