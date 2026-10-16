"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/notifications/list";
import { hasSubscription, removeSubscription, saveSubscription, type SaveResult } from "@/lib/notifications/push/subscriptions";

const idSchema = z.uuid();
const endpointSchema = z.url().max(1000);

// Inputs are typed as unknown: they come from the browser.

/** Turns alerts on for this device (the subscription the browser made). */
export async function saveAlertsAction(subscription: unknown): Promise<SaveResult> {
  const me = await requireActiveStudent();
  return saveSubscription(me.id, subscription);
}

/** Turns alerts off for this device. */
export async function removeAlertsAction(endpoint: unknown): Promise<void> {
  const me = await requireActiveStudent();
  const parsed = endpointSchema.safeParse(endpoint);
  if (parsed.success) await removeSubscription(me.id, parsed.data);
}

/** Whether the server has alerts on for this device and this student. */
export async function checkAlertsAction(endpoint: unknown): Promise<boolean> {
  const me = await requireActiveStudent();
  const parsed = endpointSchema.safeParse(endpoint);
  return parsed.success ? hasSubscription(me.id, parsed.data) : false;
}

export async function markNotificationReadAction(id: unknown): Promise<void> {
  const me = await requireActiveStudent();
  const parsed = idSchema.safeParse(id);
  if (parsed.success && (await markNotificationRead(me.id, parsed.data))) refresh();
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const me = await requireActiveStudent();
  if ((await markAllNotificationsRead(me.id)) > 0) refresh();
}
