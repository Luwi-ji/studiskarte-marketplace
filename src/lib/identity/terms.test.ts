import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { completeSignUp } from "@/lib/identity/profile";
import { AGE_REQUIRED } from "@/lib/identity/age";
import { acceptTerms, NOTHING_TO_ACCEPT, TERMS_CHANGED } from "@/lib/identity/terms";
import type { LegalSet } from "@/lib/legal/documents";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

const legal = vi.hoisted(() => ({ current: null as LegalSet | null }));
vi.mock("@/lib/legal/documents", async (original) => ({ ...(await original<typeof import("@/lib/legal/documents")>()), currentLegal: () => legal.current }));

const db = getDb();
const run = randomUUID().slice(0, 6);
const newcomer = `tm-n-${run}`;
const veteran = `tm-v-${run}`;
const set = (version: string): LegalSet => ({ version, text: { terms: "t", privacy: "p", guidelines: "g", "child-safety": "c" } });
const row = async (id: string) => (await db.select({ v: student.termsVersion, at: student.termsAcceptedAt, age: student.ageConfirmedAt, h: student.handle }).from(student).where(eq(student.id, id)))[0];

beforeAll(async () => {
  await createTestStudent(newcomer);
  await createTestStudent(veteran, { handle: `tmv_${run}`, name: "Vee" });
});
beforeEach(() => {
  legal.current = null;
});
afterAll(async () => {
  for (const id of [newcomer, veteran]) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("accepting the terms", () => {
  it("records the version and time for a student who was shown the current version", async () => {
    legal.current = set("v1");
    const now = new Date("2026-11-01T00:00:00Z");
    expect(await acceptTerms(veteran, "v1", true, now)).toEqual({ ok: true });
    expect(await row(veteran)).toMatchObject({ v: "v1", at: now, age: now });
  });

  it("refuses a version that is no longer current, and records nothing when there are no documents", async () => {
    legal.current = set("v3");
    expect(await acceptTerms(veteran, "v2", true)).toEqual({ ok: false, error: TERMS_CHANGED });
    legal.current = null;
    expect(await acceptTerms(veteran, "v3", true)).toEqual({ ok: false, error: NOTHING_TO_ACCEPT });
    expect((await row(veteran)).v).toBe("v1");
  });

  it("records nothing when the person does not confirm they meet the minimum age", async () => {
    legal.current = set("v4");
    expect(await acceptTerms(veteran, "v4", false)).toEqual({ ok: false, error: AGE_REQUIRED });
    expect((await row(veteran)).v).toBe("v1");
  });
});

describe("finishing sign-up with legal documents", () => {
  it("does not finish without accepting the current version and confirming the minimum age, then records both", async () => {
    legal.current = set("v1");
    const input = { handle: `tmn_${run}`, displayName: "Newcomer" };
    for (const accepted of [undefined, null, "old"]) {
      expect(await completeSignUp(newcomer, { ...input, acceptedTermsVersion: accepted, ageConfirmed: true })).toMatchObject({ ok: false, field: "terms" });
    }
    expect(await completeSignUp(newcomer, { ...input, acceptedTermsVersion: "v1" })).toEqual({ ok: false, field: "age", message: AGE_REQUIRED });
    expect((await row(newcomer)).h).toBeNull();
    expect(await completeSignUp(newcomer, { ...input, acceptedTermsVersion: "v1", ageConfirmed: true })).toEqual({ ok: true });
    expect(await row(newcomer)).toMatchObject({ v: "v1", h: `tmn_${run}` });
    expect((await row(newcomer)).age).toBeInstanceOf(Date);
  });
});
