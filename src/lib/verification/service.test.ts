import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { idConsent, idImageView, idVerification, image, notification, post, rateLimitEvent, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";
import { createPost, type SaveResult, SHOWCASE_NEEDS_ID_CHECK } from "@/lib/posts/create";
import type { NewPostInput } from "@/lib/posts/schema";
import { CHECK_VALID_DAYS, MAX_REJECTED_CHECKS, OPEN_CHECK_KEEP_DAYS } from "@/lib/verification/config";
import { ID_CONSENT_VERSION } from "@/lib/verification/consent";
import { addPicture, decideCheck, expireChecks, getMyCheck, listPendingChecks, NOT_ADMIN, startCheck, submitCheck, viewPicture, withdrawConsent } from "@/lib/verification/service";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

vi.setConfig({ testTimeout: 120_000 });

const db = getDb();
const run = randomUUID().slice(0, 6);
const ann = `idc-a-${run}`;
const visitor = `idc-v-${run}`;
const noAge = `idc-n-${run}`;
const admin = `idc-adm-${run}`;
const people = [ann, visitor, noAge, admin];
const DAY = 86_400_000;

/** A bucket that lives in memory, so a test can see exactly which pictures exist. */
function memoryStore() {
  const objects = new Map<string, Buffer>();
  const store: ObjectStore = {
    put: async (key, body) => void objects.set(key, body),
    delete: async (keys) => void keys.forEach((k) => objects.delete(k)),
    signedUrl: async (key, ttl) => `https://bucket.test/${key}?ttl=${ttl}`,
  };
  return { store, objects };
}

let picture: Buffer;
let picture2: Buffer;
beforeAll(async () => {
  picture = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#336699" } }).png().toBuffer();
  picture2 = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#993366" } }).png().toBuffer();
  await createTestStudent(ann, { handle: `idca_${run}`, name: "Ann Student" });
  await createTestStudent(visitor, { handle: `idcv_${run}`, visitor: true });
  await createTestStudent(noAge, { handle: `idcn_${run}`, name: "No Age" });
  await createTestStudent(admin, { handle: `idcm_${run}`, name: "Ada Admin", isAdmin: true });
  await db.update(student).set({ ageConfirmedAt: new Date() }).where(inArray(student.id, [ann, admin]));
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("R2_ID_BUCKET", "id-bucket-test");
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
});

afterEach(async () => {
  await db.delete(idImageView).where(inArray(idImageView.adminId, people));
  await db.delete(idVerification).where(inArray(idVerification.studentId, people));
  await db.delete(idConsent).where(inArray(idConsent.studentId, people));
  await db.delete(post).where(eq(post.ownerId, ann));
  await db.update(student).set({ idCheckedAt: null, idCheckExpiresAt: null }).where(inArray(student.id, people));
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await db.delete(image).where(inArray(image.ownerId, people));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, people));
  for (const id of people) await deleteTestStudent(id);
  await getPool().end();
});

/** Ann asks, adds both pictures and sends them. */
async function pendingCheck(store: ObjectStore, who = ann): Promise<string> {
  const started = await startCheck({ studentId: who, documentKind: "school_id", consented: true });
  if (!started.ok) throw new Error(started.error);
  for (const slot of ["document", "holding"] as const) {
    const added = await addPicture({ studentId: who, slot, bytes: slot === "document" ? picture : picture2, store });
    if (!added.ok) throw new Error(added.error);
  }
  const sent = await submitCheck(who);
  if (!sent.ok) throw new Error(sent.error);
  return started.id;
}

const row = async (id: string) => (await db.select().from(idVerification).where(eq(idVerification.id, id)))[0];
const studentRow = async (id: string) => (await db.select({ at: student.idCheckedAt, until: student.idCheckExpiresAt }).from(student).where(eq(student.id, id)))[0];

describe("asking for a check", () => {
  it("is closed until the private bucket is set", async () => {
    vi.stubEnv("R2_ID_BUCKET", "");
    expect(await startCheck({ studentId: ann, documentKind: "school_id", consented: true })).toMatchObject({ ok: false });
    expect(await getMyCheck(ann)).toMatchObject({ enabled: false, canAsk: false });
  });

  it("needs the box ticked, a school email, a confirmed age and a known document", async () => {
    expect(await startCheck({ studentId: ann, documentKind: "school_id", consented: false })).toMatchObject({ ok: false });
    expect(await startCheck({ studentId: ann, documentKind: "passport", consented: true })).toMatchObject({ ok: false });
    expect(await startCheck({ studentId: visitor, documentKind: "school_id", consented: true })).toMatchObject({ ok: false });
    expect(await startCheck({ studentId: noAge, documentKind: "school_id", consented: true })).toMatchObject({ ok: false });
    expect(await db.select().from(idConsent).where(inArray(idConsent.studentId, people))).toEqual([]);
    expect(await db.select().from(idVerification).where(inArray(idVerification.studentId, people))).toEqual([]);
  });

  it("records the consent with the text version, and asking again returns the same draft with no second consent", async () => {
    const first = await startCheck({ studentId: ann, documentKind: "registration", consented: true });
    const again = await startCheck({ studentId: ann, documentKind: "school_id", consented: true });
    expect(first).toMatchObject({ ok: true });
    expect(again).toEqual(first);
    const consents = await db.select().from(idConsent).where(eq(idConsent.studentId, ann));
    expect(consents).toMatchObject([{ event: "given", textVersion: ID_CONSENT_VERSION }]);
    expect(await getMyCheck(ann)).toMatchObject({ open: { status: "draft", documentKind: "registration", hasDocument: false, hasHolding: false } });
  });
});

describe("adding pictures and sending", () => {
  it("keeps the pictures in the private store, replaces one in the same slot, and needs both before sending", async () => {
    const { store, objects } = memoryStore();
    await startCheck({ studentId: ann, documentKind: "school_id", consented: true });
    expect(await submitCheck(ann)).toMatchObject({ ok: false });

    expect(await addPicture({ studentId: ann, slot: "document", bytes: picture, store })).toEqual({ ok: true });
    expect(await submitCheck(ann)).toMatchObject({ ok: false });
    const [firstKey] = [...objects.keys()];
    expect(await addPicture({ studentId: ann, slot: "document", bytes: picture, store })).toEqual({ ok: true });
    expect(objects.has(firstKey)).toBe(false);
    expect(objects.size).toBe(1);

    expect(await addPicture({ studentId: ann, slot: "holding", bytes: picture2, store })).toEqual({ ok: true });
    expect(objects.size).toBe(2);
    expect([...objects.keys()].every((k) => k.startsWith(`id/${ann}/`))).toBe(true);
    expect(await submitCheck(ann)).toEqual({ ok: true });
    expect((await listPendingChecks()).filter((p) => p.studentId === ann)).toMatchObject([{ handle: `idca_${run}`, claimedRole: "student", documentKind: "school_id", earlierRejections: 0 }]);
  });

  it("refuses the same picture in both slots, in either order, and accepts a different one", async () => {
    const { store, objects } = memoryStore();
    await startCheck({ studentId: ann, documentKind: "school_id", consented: true });
    expect(await addPicture({ studentId: ann, slot: "document", bytes: picture, store })).toEqual({ ok: true });
    expect(await addPicture({ studentId: ann, slot: "holding", bytes: picture, store })).toMatchObject({ ok: false });
    expect(objects.size).toBe(1);
    expect(await submitCheck(ann)).toMatchObject({ ok: false });
    expect(await addPicture({ studentId: ann, slot: "holding", bytes: picture2, store })).toEqual({ ok: true });
    // Putting the ID picture back into the selfie's slot is refused the other way round too.
    expect(await addPicture({ studentId: ann, slot: "document", bytes: picture2, store })).toMatchObject({ ok: false });
    expect(await submitCheck(ann)).toEqual({ ok: true });
  });

  it("refuses bytes that are not a picture, and a person with no open check", async () => {
    const { store, objects } = memoryStore();
    expect(await addPicture({ studentId: ann, slot: "document", bytes: picture, store })).toMatchObject({ ok: false });
    await startCheck({ studentId: ann, documentKind: "school_id", consented: true });
    expect(await addPicture({ studentId: ann, slot: "document", bytes: Buffer.from("not a picture"), store })).toMatchObject({ ok: false });
    expect(objects.size).toBe(0);
  });
});

describe("the owner's decision", () => {
  it("approves: pictures are deleted first, the badge is given for a year, and only the result stays", async () => {
    const { store, objects } = memoryStore();
    const id = await pendingCheck(store);
    expect(objects.size).toBe(2);
    const now = new Date("2026-11-01T00:00:00Z");

    expect(await decideCheck({ adminId: admin, verificationId: id, decision: "approve", store, now })).toEqual({ ok: true });
    expect(objects.size).toBe(0);
    expect(await row(id)).toMatchObject({ status: "approved", documentKey: null, holdingKey: null, decidedBy: admin, decidedAt: now });
    expect(await studentRow(ann)).toEqual({ at: now, until: new Date(now.getTime() + CHECK_VALID_DAYS * DAY) });
    expect(await decideCheck({ adminId: admin, verificationId: id, decision: "approve", store })).toMatchObject({ ok: false });
  });

  it("tells the person in their notifications, with the reason when rejected, and never without a decision", async () => {
    const { store } = memoryStore();
    const notices = async () => db.select({ type: notification.type, detail: notification.detail }).from(notification).where(eq(notification.recipientId, ann));
    await db.delete(notification).where(eq(notification.recipientId, ann));
    const first = await pendingCheck(store);
    expect(await notices()).toEqual([]);
    expect(await decideCheck({ adminId: ann, verificationId: first, decision: "approve", store })).toMatchObject({ ok: false });
    expect(await notices()).toEqual([]);
    await decideCheck({ adminId: admin, verificationId: first, decision: "reject", reason: "Too dark", store });
    expect(await notices()).toEqual([{ type: "id_check_rejected", detail: "Too dark" }]);
    await db.delete(notification).where(eq(notification.recipientId, ann));
    const second = await pendingCheck(store);
    await decideCheck({ adminId: admin, verificationId: second, decision: "approve", store });
    expect(await notices()).toEqual([{ type: "id_check_approved", detail: null }]);
  });

  it("refuses anyone who is not an admin and changes nothing", async () => {
    const { store, objects } = memoryStore();
    const id = await pendingCheck(store);
    expect(await decideCheck({ adminId: ann, verificationId: id, decision: "approve", store })).toEqual({ ok: false, error: NOT_ADMIN });
    expect(objects.size).toBe(2);
    expect((await row(id)).status).toBe("pending");
    expect((await studentRow(ann)).at).toBeNull();
  });

  it("needs a reason to reject, shows it to the person, and stops asking after the limit", async () => {
    const { store } = memoryStore();
    for (let n = 1; n <= MAX_REJECTED_CHECKS; n++) {
      const id = await pendingCheck(store);
      expect(await decideCheck({ adminId: admin, verificationId: id, decision: "reject", reason: "  ", store })).toMatchObject({ ok: false });
      expect(await decideCheck({ adminId: admin, verificationId: id, decision: "reject", reason: "The photo is blurry", store })).toEqual({ ok: true });
      expect(await getMyCheck(ann)).toMatchObject({ rejectedCount: n, lastRejection: { reason: "The photo is blurry" } });
    }
    expect(await startCheck({ studentId: ann, documentKind: "school_id", consented: true })).toMatchObject({ ok: false });
    expect((await studentRow(ann)).at).toBeNull();
  });
});

describe("looking at the pictures", () => {
  it("writes each view down before handing out a short link, and only to an admin, only while pending", async () => {
    const { store } = memoryStore();
    const id = await pendingCheck(store);
    expect(await viewPicture({ adminId: ann, verificationId: id, slot: "document", store })).toMatchObject({ ok: false });
    expect(await db.select().from(idImageView).where(eq(idImageView.verificationId, id))).toEqual([]);

    const seen = await viewPicture({ adminId: admin, verificationId: id, slot: "holding", store });
    expect(seen).toMatchObject({ ok: true, url: expect.stringContaining("ttl=60") });
    expect(await db.select().from(idImageView).where(eq(idImageView.verificationId, id))).toMatchObject([{ adminId: admin, slot: "holding" }]);

    await decideCheck({ adminId: admin, verificationId: id, decision: "reject", reason: "no", store });
    expect(await viewPicture({ adminId: admin, verificationId: id, slot: "holding", store })).toMatchObject({ ok: false });
  });
});

describe("withdrawing consent", () => {
  it("deletes waiting pictures, closes the check and writes the withdrawal down", async () => {
    const { store, objects } = memoryStore();
    const id = await pendingCheck(store);
    expect(await withdrawConsent({ studentId: ann, store })).toEqual({ ok: true });
    expect(objects.size).toBe(0);
    expect(await row(id)).toMatchObject({ status: "withdrawn", documentKey: null, holdingKey: null });
    const events = (await db.select({ event: idConsent.event, channel: idConsent.channel }).from(idConsent).where(eq(idConsent.studentId, ann))).map((e) => e.event).sort();
    expect(events).toEqual(["given", "withdrawn"]);
  });

  it("removes the badge after an approval, and says so when there is nothing to withdraw", async () => {
    const { store } = memoryStore();
    const id = await pendingCheck(store);
    await decideCheck({ adminId: admin, verificationId: id, decision: "approve", store });
    expect((await studentRow(ann)).at).not.toBeNull();
    expect(await withdrawConsent({ studentId: ann, store })).toEqual({ ok: true });
    expect(await studentRow(ann)).toEqual({ at: null, until: null });
    expect(await withdrawConsent({ studentId: ann, store })).toMatchObject({ ok: false });
  });
});

describe("housekeeping", () => {
  it("closes checks left open too long and deletes their pictures, and lets a lapsed approval go", async () => {
    const { store, objects } = memoryStore();
    const id = await pendingCheck(store);
    const old = new Date(Date.now() - (OPEN_CHECK_KEEP_DAYS + 1) * DAY);
    await db.update(idVerification).set({ submittedAt: old, createdAt: old }).where(eq(idVerification.id, id));
    expect((await expireChecks(store)).closed).toBeGreaterThanOrEqual(1);
    expect(objects.size).toBe(0);
    expect(await row(id)).toMatchObject({ status: "expired", documentKey: null });

    const next = await pendingCheck(store);
    await decideCheck({ adminId: admin, verificationId: next, decision: "approve", store, now: new Date(Date.now() - 400 * DAY) });
    expect((await expireChecks(store)).lapsed).toBeGreaterThanOrEqual(1);
    expect(await studentRow(ann)).toEqual({ at: null, until: null });
    expect((await row(next)).status).toBe("expired");
  });

  it("does not touch a recent open check or a current approval", async () => {
    const { store, objects } = memoryStore();
    const id = await pendingCheck(store);
    await expireChecks(store);
    expect((await row(id)).status).toBe("pending");
    expect(objects.size).toBe(2);
  });
});

describe("the showcase limit", () => {
  let counter = 0;
  async function showcase(): Promise<SaveResult> {
    counter += 1;
    const name = randomUUID();
    const [img] = await db
      .insert(image)
      .values({ ownerId: ann, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
      .returning({ id: image.id });
    const input: NewPostInput = {
      kind: "showcase",
      title: `Limit ${run} #${counter}`,
      description: "A showcase.",
      categoryId: "other",
      condition: null,
      priceKind: "free",
      priceAmount: "",
      paymentCash: true,
      paymentOnline: false,
      paymentOther: false,
      paymentNote: "",
      quantity: "1",
      exchangeMeetup: true,
      exchangeDelivery: false,
      meetupLocation: "Main gate",
      availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
      photos: photosOf([img.id]),
    };
    return createPost({ ownerId: ann, input });
  }

  it("allows one open showcase without a check, then lifts the limit with one", async () => {
    expect(await showcase()).toMatchObject({ ok: true });
    expect(await showcase()).toEqual({ ok: false, errors: { form: SHOWCASE_NEEDS_ID_CHECK } });

    const { store } = memoryStore();
    const id = await pendingCheck(store);
    await decideCheck({ adminId: admin, verificationId: id, decision: "approve", store });
    expect(await showcase()).toMatchObject({ ok: true });
  });

  it("is off while ID checks are closed, because nobody could lift it", async () => {
    vi.stubEnv("R2_ID_BUCKET", "");
    expect(await showcase()).toMatchObject({ ok: true });
    expect(await showcase()).toMatchObject({ ok: true });
  });
});
