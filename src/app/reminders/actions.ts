"use server";

import { and, count, eq } from "drizzle-orm";
import { post } from "@/db/schema";
import { getSignedInStudent } from "@/lib/access";
import { getDb } from "@/lib/db";
import type { ReminderContext } from "@/lib/reminders/rules";
import { isSupplyBlocked, showcaseStanding } from "@/lib/posts/showcase-limit";

/** What the reminder rules need to know about the signed-in person, read at the moment they are about to act. Null when signed out. */
export async function reminderContextAction(): Promise<ReminderContext | null> {
  const me = await getSignedInStudent();
  if (!me) return null;
  const db = getDb();
  const [showcase, wishlistBlocked, [{ open }]] = await Promise.all([
    me.role === "student" ? showcaseStanding(db, me.id) : Promise.resolve("off" as const),
    me.role === "student" ? isSupplyBlocked(db, me.id) : Promise.resolve(false),
    db.select({ open: count() }).from(post).where(and(eq(post.ownerId, me.id), eq(post.status, "open"))),
  ]);
  return { role: me.role, showcase, wishlistBlocked, openPosts: open };
}
