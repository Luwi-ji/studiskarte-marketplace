"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { deleteContactMessage } from "@/lib/admin/inbox";

/** Deletes a landing-page message once it has been answered. */
export async function deleteContactMessageAction(id: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: "That message could not be found." };
    const result = await deleteContactMessage(admin.id, parsed.data);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("admin action delete-contact-message failed", error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}
