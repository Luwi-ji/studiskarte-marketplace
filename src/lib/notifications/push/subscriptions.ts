import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { pushSubscription, student } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Devices one student may have alerts on at once. */
export const SUBSCRIPTIONS_MAX = 10;

// What the browser's PushSubscription.toJSON() gives.
const subscriptionSchema = z.object({
  endpoint: z
    .url()
    .max(1000)
    .refine((url) => url.startsWith("https://"), "push addresses are https"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{40,200}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/),
  }),
});

export type SaveResult = "ok" | "invalid" | "limit" | "not_allowed";

/**
 * Turns alerts on for this device. Only an active student may. If the device
 * was last used by someone else (a shared phone), it now belongs to this
 * student. The address is what identifies the device.
 */
export async function saveSubscription(studentId: string, input: unknown): Promise<SaveResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return "invalid";
  const db = getDb();
  const [me] = await db.select({ status: student.accountStatus }).from(student).where(eq(student.id, studentId));
  if (!me || me.status !== "active") return "not_allowed";

  const [others] = await db
    .select({ n: count() })
    .from(pushSubscription)
    .where(and(eq(pushSubscription.studentId, studentId), ne(pushSubscription.endpoint, parsed.data.endpoint)));
  if (others.n >= SUBSCRIPTIONS_MAX) return "limit";

  await db
    .insert(pushSubscription)
    .values({ studentId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscription.endpoint,
      set: { studentId, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, createdAt: new Date() },
    });
  return "ok";
}

/** Turns alerts off for a device. Only removes the student's own. */
export async function removeSubscription(studentId: string, endpoint: string): Promise<void> {
  await getDb()
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.studentId, studentId), eq(pushSubscription.endpoint, endpoint)));
}

/** Whether alerts are on for this device for this student. */
export async function hasSubscription(studentId: string, endpoint: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(pushSubscription)
    .where(and(eq(pushSubscription.studentId, studentId), eq(pushSubscription.endpoint, endpoint)));
  return row.n > 0;
}
