import { createHmac, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { auth } from "@/lib/identity/auth";
import { loginWithPassword } from "@/lib/identity/password";
import { createTestStudent } from "@/test/fixtures";

const id = `mfa-${randomUUID()}`;
const password = "correct horse battery";

function cookieHeader(setCookie: string): string {
  return setCookie.split(/,(?=\s*[\w.-]+=)/).map((cookie) => cookie.split(";")[0].trim()).join("; ");
}

function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of secret.toUpperCase().replace(/=+$/, "")) bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

afterAll(async () => {
  await getDb().delete(student).where(eq(student.id, id));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("administrator TOTP", () => {
  it("enrolls, verifies, and challenges the next password login", async () => {
    const made = await createTestStudent(id, { isAdmin: true });
    const context = await auth.$context;
    await context.internalAdapter.linkAccount({ userId: id, providerId: "credential", accountId: id, password: await context.password.hash(password) });
    const signedIn = await auth.api.signInEmail({ body: { email: made.email, password }, returnHeaders: true });
    const headers = new Headers({ cookie: cookieHeader(signedIn.headers.get("set-cookie") ?? "") });

    const enrollment = await auth.api.enableTwoFactor({ body: { password, method: "totp", issuer: "Studiskarte" }, headers });
    expect(enrollment.method).toBe("totp");
    if (enrollment.method !== "totp") throw new Error("TOTP enrollment was not returned");
    expect(enrollment.backupCodes.length).toBeGreaterThan(1);
    const secret = new URL(enrollment.totpURI).searchParams.get("secret");
    expect(secret).toBeTruthy();
    await auth.api.verifyTOTP({ body: { code: totp(secret!), trustDevice: false }, headers });

    const [saved] = await getDb().select({ enabled: student.twoFactorEnabled }).from(student).where(eq(student.id, id));
    expect(saved.enabled).toBe(true);
    await expect(loginWithPassword(made.email, password, new Headers())).resolves.toEqual({ ok: true, twoFactor: true });
  });
});
