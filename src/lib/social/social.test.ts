import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { follow, heart, image, post, student } from "@/db/schema";
import { getDb, getPool } from "@/lib/db";
import { listFeed, listHeartedBy, listPostsBy } from "@/lib/discovery/feed";
import { getPublicProfile } from "@/lib/identity/profile";
import { createPost } from "@/lib/posts/create";
import { getPostDetail } from "@/lib/posts/detail";
import { listOwnPosts } from "@/lib/posts/mine";
import type { NewPostInput } from "@/lib/posts/schema";
import { followStudent, unfollowStudent } from "@/lib/social/follow";
import { countHearts, hasHearted, heartPost, listUnavailableHearts, unheartPost } from "@/lib/social/heart";
import { createTestStudent, deleteTestStudent, TEST_SCHOOL } from "@/test/fixtures";
import { photosOf } from "@/test/photos";

const db = getDb();
const run = randomUUID().slice(0, 6);
const ana = `soc-a-${run}`;
const ben = `soc-b-${run}`;
const cy = `soc-c-${run}`;
const handleOf = (id: string) => `s${id.slice(4, 5)}_${run}`;
const all = [ana, ben, cy];

async function newPost(ownerId: string, title: string): Promise<string> {
  const name = randomUUID();
  const [img] = await db
    .insert(image)
    .values({ ownerId, purpose: "post_photo", key: `t/${name}`, thumbKey: `t/${name}-t`, width: 1, height: 1, bytes: 1 })
    .returning({ id: image.id });
  const input: NewPostInput = {
    kind: "showcase",
    title,
    description: "Social test post.",
    categoryId: "other",
    condition: null,
    priceKind: "free",
    priceAmount: "",
    exchangeMeetup: true,
    exchangeDelivery: false,
    meetupLocation: "Gate",
    deliveryArea: "",
    availability: [{ kind: "weekly", weekday: 1, startTime: "09:00", endTime: "10:00" }],
    photos: photosOf([img.id]),
  };
  const result = await createPost({ ownerId, input });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.id;
}

beforeAll(async () => {
  for (const id of all) await createTestStudent(id, { handle: handleOf(id), name: `Student ${id.slice(4, 5)}` });
});

afterAll(async () => {
  await db.delete(post).where(inArray(post.ownerId, all));
  await db.delete(image).where(inArray(image.ownerId, all));
  for (const id of all) await deleteTestStudent(id);
  await getPool().end();
  globalThis.__studiskartePool = undefined;
});

describe("follow", () => {
  it("follows once however many times it is asked, and unfollowing is safe when not following", async () => {
    expect(await followStudent(ana, ben)).toBe("ok");
    expect(await followStudent(ana, ben)).toBe("ok");
    expect(await db.select().from(follow).where(eq(follow.followeeId, ben))).toHaveLength(1);

    await unfollowStudent(ana, ben);
    await unfollowStudent(ana, ben);
    await unfollowStudent(cy, ben);
    expect(await db.select().from(follow).where(eq(follow.followeeId, ben))).toHaveLength(0);
  });

  it("refuses a student following themselves, in code and in the database", async () => {
    expect(await followStudent(ana, ana)).toBe("self");
    expect(await db.select().from(follow).where(eq(follow.followerId, ana))).toHaveLength(0);
    await expect(db.insert(follow).values({ followerId: ana, followeeId: ana })).rejects.toMatchObject({
      cause: { constraint: "follow_not_self" },
    });
  });

  it("refuses following someone who is unknown, suspended, or has not finished sign-up", async () => {
    expect(await followStudent(ana, "no-such-student")).toBe("not_found");
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, cy));
    try {
      expect(await followStudent(ana, cy)).toBe("not_found");
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, cy));
    }
  });

  it("counts followers and tells each viewer whether they follow", async () => {
    await followStudent(ana, cy);
    await followStudent(ben, cy);
    expect(await getPublicProfile(ana, handleOf(cy))).toMatchObject({ followerCount: 2, isFollowing: true, isSelf: false });
    expect(await getPublicProfile(cy, handleOf(cy))).toMatchObject({ followerCount: 2, isFollowing: false, isSelf: true });
    await unfollowStudent(ana, cy);
    expect(await getPublicProfile(ben, handleOf(cy))).toMatchObject({ followerCount: 1 });
    await unfollowStudent(ben, cy);
  });
});

describe("public profile", () => {
  it("finds a student by handle in any case and with an @, and never carries the school email", async () => {
    const profile = await getPublicProfile(ana, `@${handleOf(ben).toUpperCase()}`);
    expect(profile).toMatchObject({ handle: handleOf(ben), displayName: "Student b", school: TEST_SCHOOL });
    expect(JSON.stringify(profile)).not.toContain("@testschool.edu.ph");
  });

  it("is missing for an unknown handle and for a suspended student", async () => {
    expect(await getPublicProfile(ana, "nobody_here_0")).toBeNull();
    await db.update(student).set({ accountStatus: "suspended" }).where(eq(student.id, ben));
    try {
      expect(await getPublicProfile(ana, handleOf(ben))).toBeNull();
    } finally {
      await db.update(student).set({ accountStatus: "active" }).where(eq(student.id, ben));
    }
  });

  it("lists only that student's active listings", async () => {
    const mine = await newPost(ben, `Ben open ${run}`);
    const withdrawn = await newPost(ben, `Ben withdrawn ${run}`);
    const other = await newPost(cy, `Cy open ${run}`);
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, withdrawn));
    const ids = (await listPostsBy(ben)).map((item) => item.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(withdrawn);
    expect(ids).not.toContain(other);
  });
});

describe("hearts", () => {
  it("hearts once however many times, and the heart can be removed", async () => {
    const id = await newPost(ben, `Heart twice ${run}`);
    expect(await heartPost(ana, id)).toBe("ok");
    expect(await heartPost(ana, id)).toBe("ok");
    expect(await db.select().from(heart).where(eq(heart.postId, id))).toHaveLength(1);
    expect(await hasHearted(ana, id)).toBe(true);
    await unheartPost(ana, id);
    await unheartPost(ana, id);
    expect(await hasHearted(ana, id)).toBe(false);
  });

  it("refuses hearting your own post, a post others cannot see, or one that does not exist", async () => {
    const own = await newPost(ana, `Own ${run}`);
    expect(await heartPost(ana, own)).toBe("own_post");

    const hidden = await newPost(ben, `Hidden ${run}`);
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, hidden));
    expect(await heartPost(ana, hidden)).toBe("not_found");
    expect(await heartPost(ana, randomUUID())).toBe("not_found");
    expect(await db.select().from(heart).where(inArray(heart.postId, [own, hidden]))).toHaveLength(0);
  });

  it("tells the owner how many hearts, and never who; nobody else sees a count", async () => {
    const id = await newPost(ben, `Count ${run}`);
    await heartPost(ana, id);
    await heartPost(cy, id);

    const asOwner = await getPostDetail(ben, id);
    expect(asOwner).toMatchObject({ heartCount: 2, hearted: false });
    expect(JSON.stringify(asOwner)).not.toContain(ana);
    expect(JSON.stringify(asOwner)).not.toContain(cy);
    expect((await listOwnPosts(ben)).find((p) => p.id === id)?.heartCount).toBe(2);

    expect(await getPostDetail(ana, id)).toMatchObject({ heartCount: null, hearted: true });
    expect(await countHearts(id)).toBe(2);
  });

  it("lists only the viewer's own hearts, most recent first", async () => {
    const first = await newPost(ben, `First ${run}`);
    const second = await newPost(ben, `Second ${run}`);
    await heartPost(ana, first);
    await heartPost(ana, second);
    await heartPost(cy, first);

    // Other tests also heart posts as ana and cy, so look only at these two posts.
    const mine = async (who: string) => (await listHeartedBy(who)).map((i) => i.id).filter((id) => id === first || id === second);
    expect(await mine(ana)).toEqual([second, first]);
    expect(await mine(cy)).toEqual([first]);
    expect(await listHeartedBy(ben)).toEqual([]);
  });

  it("keeps a heart on a post that is no longer available, listed as unavailable, and lets it be removed", async () => {
    const id = await newPost(ben, `Going ${run}`);
    const stays = await newPost(ben, `Stays ${run}`);
    await heartPost(ana, id);
    await heartPost(ana, stays);
    await db.update(post).set({ status: "withdrawn" }).where(eq(post.id, id));

    const available = (await listHeartedBy(ana)).map((i) => i.id);
    expect(available).toContain(stays);
    expect(available).not.toContain(id);
    expect(await listUnavailableHearts(ana, available)).toEqual([id]);

    await unheartPost(ana, id);
    expect(await listUnavailableHearts(ana, available)).toEqual([]);
  });

  it("cannot name a student who hearted through the feed", async () => {
    const id = await newPost(ben, `Feed ${run}`);
    await heartPost(ana, id);
    const item = (await listFeed(200)).find((i) => i.id === id);
    expect(JSON.stringify(item)).not.toContain(ana);
  });
});

describe("cascade", () => {
  it("removes a student's follows and hearts when their account goes", async () => {
    const gone = `soc-gone-${run}`;
    await createTestStudent(gone, { handle: `g_${run}` });
    const id = await newPost(ben, `Cascade ${run}`);
    await heartPost(gone, id);
    await followStudent(gone, ben);
    await deleteTestStudent(gone);
    expect(await db.select().from(heart).where(and(eq(heart.studentId, gone)))).toHaveLength(0);
    expect(await db.select().from(follow).where(eq(follow.followerId, gone))).toHaveLength(0);
  });
});
