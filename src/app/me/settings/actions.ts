"use server";

import { refresh } from "next/cache";
import { requireActiveStudent } from "@/lib/access";
import { changeDisplayName, changeHandle } from "@/lib/identity/profile";

export type FieldState = { value: string; error?: string; saved?: boolean };

export async function saveDisplayName(_prev: FieldState, formData: FormData): Promise<FieldState> {
  const value = String(formData.get("displayName") ?? "");
  const me = await requireActiveStudent();
  const result = await changeDisplayName(me.id, value);
  if (!result.ok) return { value, error: result.message };
  refresh();
  return { value: value.trim(), saved: true };
}

export async function saveHandle(_prev: FieldState, formData: FormData): Promise<FieldState> {
  const value = String(formData.get("handle") ?? "");
  const me = await requireActiveStudent();
  const result = await changeHandle(me.id, value);
  if (!result.ok) return { value, error: result.message };
  refresh();
  return { value: value.trim().replace(/^@/, "").toLowerCase(), saved: true };
}
