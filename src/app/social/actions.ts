"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { getPublicProfile } from "@/lib/identity/profile";
import { followStudent, unfollowStudent } from "@/lib/social/follow";
import { heartPost, unheartPost } from "@/lib/social/heart";

const postIdSchema = z.uuid();
// Same limits as a handle (3 to 20 of a-z 0-9 . _), so junk never reaches the database.
const handleSchema = z.string().min(3).max(21).regex(/^@?[A-Za-z0-9._]+$/);

// Inputs are typed as unknown: they come from the browser.

/** Follows (or, with follow=false, unfollows) the student with this handle. Returns whether it worked. */
export async function setFollowAction(handle: unknown, follow: unknown): Promise<{ ok: boolean }> {
  const me = await requireActiveStudent();
  const parsed = handleSchema.safeParse(handle);
  if (!parsed.success || typeof follow !== "boolean") return { ok: false };
  const profile = await getPublicProfile(me.id, parsed.data);
  if (!profile) return { ok: false };
  if (follow) {
    if ((await followStudent(me.id, profile.id)) !== "ok") return { ok: false };
  } else {
    await unfollowStudent(me.id, profile.id);
  }
  refresh();
  return { ok: true };
}

/** Hearts (or, with heart=false, un-hearts) a post for the signed-in student. Returns whether it worked. */
export async function setHeartAction(postId: unknown, heart: unknown): Promise<{ ok: boolean }> {
  const me = await requireActiveStudent();
  const id = postIdSchema.safeParse(postId);
  if (!id.success || typeof heart !== "boolean") return { ok: false };
  if (heart) {
    if ((await heartPost(me.id, id.data)) !== "ok") return { ok: false };
  } else {
    await unheartPost(me.id, id.data);
  }
  refresh();
  return { ok: true };
}
