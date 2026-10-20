"use server";

import { requireAdmin } from "@/lib/access";

/** Throws on purpose so the server reports it to Sentry. Admin only. */
export async function failOnServer(): Promise<void> {
  await requireAdmin();
  throw new Error(`Sentry server test ${new Date().toISOString()}`);
}
