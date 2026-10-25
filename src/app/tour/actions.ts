"use server";

import { and, eq, isNull } from "drizzle-orm";
import { student } from "@/db/schema";
import { getSignedInStudent } from "@/lib/access";
import { getDb } from "@/lib/db";

/** The person finished or skipped the first-time tour: it is not shown on its own again. Replaying it from Settings changes nothing here. */
export async function markTourSeenAction(): Promise<void> {
  const me = await getSignedInStudent();
  if (!me) return;
  await getDb()
    .update(student)
    .set({ tourSeenAt: new Date() })
    .where(and(eq(student.id, me.id), isNull(student.tourSeenAt)));
}
