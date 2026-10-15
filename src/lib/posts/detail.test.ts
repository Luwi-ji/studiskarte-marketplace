import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { image, post, rateLimitEvent, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { createPost } from "@/lib/posts/create";
import { getPostDetail } from "@/lib/posts/detail";
import { formatAvailability, formatTime } from "@/lib/posts/format";
import { withdrawPost } from "@/lib/posts/transitions";
import { createTestStudent, deleteTestStudent } from "@/test/fixtures";

const db = getDb();
const run = randomUUID().slice(0, 6);
const owner = `detail-a-${run}`;
const viewer = `detail-b-${run}`;
let ownerEmail = "";

async function photo(): Promise<string> {
  const name = randomUUID();
  const [row] = await db
    .insert(image)
    .values({ ownerId: owner, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 800, height: 600, bytes: 1 })
    .returning({ id: image.id });
  return row.id;
}

async function newPost(title: string): Promise<string> {
  const result = await createPost({
    ownerId: owner,
    input: {
      kind: "showcase",
      title,
      description: "Line one.\nLine two.",
      categoryId: "electronics.calculators",
      condition: "used_good",
      priceKind: "amount",
      priceAmount: "650",
      exchangeMeetup: true,
      exchangeDelivery: true,
      meetupLocation: "Main gate",
      deliveryArea: "Metro Manila",
      availability: [
        { kind: "date", date: "2099-01-02", startTime: "09:00", endTime: "10:00" },
        { kind: "weekly", weekday: 0, startTime: "13:00", endTime: "15:00" },
        { kind: "weekly", weekday: 1, startTime: "15:00", endTime: "17:30" },
      ],
      photoIds: [await photo(), await photo()],
    },
    now: new Date("2098-12-31T00:00:00Z"),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

beforeAll(async () => {
  ownerEmail = (await createTestStudent(owner, { handle: `da_${run}`, name: "Seller" })).email;
  await createTestStudent(viewer, { handle: `db_${run}` });
});

afterAll(async () => {
  await db.delete(post).where(eq(post.ownerId, owner));
  await db.delete(image).where(eq(image.ownerId, owner));
  await db.delete(rateLimitEvent).where(inArray(rateLimitEvent.key, [owner, viewer]));
  for (const id of [owner, viewer]) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("getPostDetail", () => {
  it("shows another student the whole open post, with no email", async () => {
    const id = await newPost(`Open ${run}`);
    const detail = await getPostDetail(viewer, id);
    expect(detail).toMatchObject({
      title: `Open ${run}`,
      description: "Line one.\nLine two.",
      categoryName: "Calculators",
      mainCategoryName: "Electronics & Gadgets",
      condition: "used_good",
      priceAmount: 650,
      meetupLocation: "Main gate",
      deliveryArea: "Metro Manila",
      isOwner: false,
      seller: { handle: `da_${run}`, displayName: "Seller", school: "testschool.edu.ph" },
    });
    expect(detail?.photos).toHaveLength(2);
    expect(JSON.stringify(detail)).not.toContain(ownerEmail);
  });

  it("lists weekdays Monday first, then dates", async () => {
    const id = await newPost(`Order ${run}`);
    const detail = await getPostDetail(viewer, id);
    expect(detail?.availability.map((a) => (a.kind === "weekly" ? a.weekday : a.date))).toEqual([1, 0, "2099-01-02"]);
  });

  it("hides a withdrawn post from others but not from its owner", async () => {
    const id = await newPost(`Gone ${run}`);
    await withdrawPost(owner, id);
    expect(await getPostDetail(viewer, id)).toBeNull();
    expect(await getPostDetail(owner, id)).toMatchObject({ status: "withdrawn", isOwner: true });
  });

  it("hides posts of a suspended student from others", async () => {
    const id = await newPost(`Suspended ${run}`);
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, owner));
    try {
      expect(await getPostDetail(viewer, id)).toBeNull();
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, owner));
    }
  });

  it("returns nothing for a post that does not exist", async () => {
    expect(await getPostDetail(viewer, randomUUID())).toBeNull();
  });
});

describe("availability text", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["09:05", "9:05 AM"],
    ["12:30", "12:30 PM"],
    ["15:00", "3:00 PM"],
    ["23:59", "11:59 PM"],
  ])("formatTime(%j) is %j", (input, expected) => {
    expect(formatTime(input)).toBe(expected);
  });

  it("describes a weekday and a date", () => {
    expect(formatAvailability({ kind: "weekly", weekday: 1, startTime: "15:00", endTime: "17:30" })).toEqual({
      day: "Every Monday",
      time: "3:00 PM – 5:30 PM",
    });
    expect(formatAvailability({ kind: "date", date: "2026-10-16", startTime: "09:00", endTime: "10:00" })).toEqual({
      day: "Fri, Oct 16",
      time: "9:00 AM – 10:00 AM",
    });
  });
});
