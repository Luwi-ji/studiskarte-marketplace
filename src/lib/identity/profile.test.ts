import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import type * as LegalDocuments from "@/lib/legal/documents";
import { afterAll, describe, expect, it, vi } from "vitest";

// These tests are about handles and names. The repository now ships real legal text, which would
// make every sign-up also need the terms box ticked; the terms rule has its own tests.
vi.mock("@/lib/legal/documents", async (importOriginal) => ({
  ...(await importOriginal<typeof LegalDocuments>()),
  currentLegal: () => null,
}));
import { image, rateLimitEvent, school, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";
import {
  changeAvatar,
  changeDisplayName,
  changeHandle,
  completeSignUp,
  getOwnProfile,
} from "@/lib/identity/profile";
import { createTestStudent, TEST_SCHOOL } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 6);
const created: string[] = [];

async function newStudent(fields: { handle?: string } = {}) {
  const id = `prof-${run}-${created.length}`;
  created.push(id);
  return createTestStudent(id, fields);
}

class MemoryStore implements ObjectStore {
  objects = new Map<string, Buffer>();
  async put(key: string, body: Buffer) {
    this.objects.set(key, body);
  }
  async delete(keys: string[]) {
    for (const key of keys) this.objects.delete(key);
  }
  async signedUrl(key: string) {
    return `memory://${key}`;
  }
}

afterAll(async () => {
  await db.update(student).set({ avatarImageId: null }).where(inArray(student.id, created));
  await db.delete(image).where(inArray(image.ownerId, created));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, created));
  await db.delete(student).where(inArray(student.id, created));
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("completeSignUp", () => {
  it("sets the first handle and display name, once", async () => {
    const { id } = await newStudent();
    expect(await completeSignUp(id, { handle: `@First_${run}`, displayName: " Niño 🌻 " })).toEqual({ ok: true });
    const profile = await getOwnProfile(id);
    expect(profile).toMatchObject({ handle: `first_${run}`, displayName: "Niño 🌻", nextHandleChangeAt: null });

    const again = await completeSignUp(id, { handle: `other_${run}`, displayName: "X" });
    expect(again.ok).toBe(false);
    expect((await getOwnProfile(id))?.handle).toBe(`first_${run}`);
  });

  it("treats handles that differ only in case as the same handle", async () => {
    const a = await newStudent();
    const b = await newStudent();
    await completeSignUp(a.id, { handle: `juan_${run}`, displayName: "Juan" });
    const result = await completeSignUp(b.id, { handle: `JUAN_${run}`, displayName: "Other Juan" });
    expect(result).toEqual({ ok: false, field: "handle", message: "That handle is taken. Choose another." });
  });

  it("refuses an invalid handle before touching the database", async () => {
    const { id } = await newStudent();
    expect(await completeSignUp(id, { handle: "a..b", displayName: "Ok" })).toMatchObject({ ok: false, field: "handle" });
    expect((await getOwnProfile(id))?.handle).toBeNull();
  });

  it("is enforced by the database too", async () => {
    const { id } = await newStudent();
    await expect(db.update(student).set({ handle: "Has.Upper" }).where(eq(student.id, id))).rejects.toMatchObject({
      cause: { constraint: "student_handle_format" },
    });
  });
});

describe("changeHandle", () => {
  it("allows the first change right after sign-up, then waits 30 days", async () => {
    const { id } = await newStudent({ handle: `start_${run}` });
    const day0 = new Date("2026-11-01T00:00:00Z");
    expect(await changeHandle(id, `second_${run}`, day0)).toEqual({ ok: true });

    const day29 = new Date("2026-11-30T00:00:00Z");
    const blocked = await changeHandle(id, `third_${run}`, day29);
    expect(blocked).toMatchObject({ ok: false, field: "handle" });
    expect((await getOwnProfile(id, day29))?.nextHandleChangeAt).toEqual(new Date("2026-12-01T00:00:00Z"));

    const day30 = new Date("2026-12-01T00:00:00Z");
    expect(await changeHandle(id, `third_${run}`, day30)).toEqual({ ok: true });
  });

  it("lets two students not both take a freed handle at once", async () => {
    const a = await newStudent({ handle: `free_${run}` });
    const b = await newStudent({ handle: `b1_${run}` });
    const c = await newStudent({ handle: `c1_${run}` });
    await changeHandle(a.id, `moved_${run}`);
    const results = await Promise.all([changeHandle(b.id, `free_${run}`), changeHandle(c.id, `free_${run}`)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("only one of two simultaneous changes by the same student wins", async () => {
    const { id } = await newStudent({ handle: `race_${run}` });
    const results = await Promise.all([changeHandle(id, `racea_${run}`), changeHandle(id, `raceb_${run}`)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });
});

describe("own profile", () => {
  it("shows the school domain until the school is named, and never the email", async () => {
    const { id, email } = await newStudent({ handle: `sch_${run}` });
    const unnamed = await getOwnProfile(id);
    expect(unnamed?.school).toBe(TEST_SCHOOL);
    expect(JSON.stringify(unnamed)).not.toContain(email);

    await db.update(school).set({ name: "Test School" }).where(eq(school.domain, TEST_SCHOOL));
    try {
      expect((await getOwnProfile(id))?.school).toBe("Test School");
    } finally {
      await db.update(school).set({ name: null }).where(eq(school.domain, TEST_SCHOOL));
    }
  });

  it("changes the display name with the same rules as sign-up", async () => {
    const { id } = await newStudent({ handle: `dn_${run}` });
    expect(await changeDisplayName(id, "Maria Clara")).toEqual({ ok: true });
    expect(await changeDisplayName(id, "x".repeat(41))).toMatchObject({ ok: false, field: "displayName" });
    expect((await getOwnProfile(id))?.displayName).toBe("Maria Clara");
  });
});

describe("changeAvatar", () => {
  it("stores a square picture and removes the previous one", async () => {
    const { id } = await newStudent({ handle: `av_${run}` });
    const store = new MemoryStore();
    const picture = (color: string) =>
      sharp({ create: { width: 900, height: 600, channels: 3, background: color } }).jpeg().toBuffer();

    await changeAvatar({ studentId: id, bytes: await picture("#aa3333"), store });
    const first = await getOwnProfile(id);
    const main = store.objects.get(first!.avatarKey!)!;
    expect(await sharp(main).metadata()).toMatchObject({ width: 512, height: 512 });

    await changeAvatar({ studentId: id, bytes: await picture("#3333aa"), store });
    const second = await getOwnProfile(id);
    expect(second?.avatarKey).not.toBe(first?.avatarKey);
    expect(store.objects.has(first!.avatarKey!)).toBe(false);
    expect(store.objects.size).toBe(2);
    expect(await db.select().from(image).where(eq(image.ownerId, id))).toHaveLength(1);
  });
});
