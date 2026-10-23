"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { setSchoolShortName } from "@/lib/admin/schools";

const domainSchema = z.string().min(1).max(120);

/** Sets a school's abbreviation, or clears it when `shortName` is empty. Cards show it once the pages refresh. */
export async function setSchoolShortNameAction(domain: unknown, shortName: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin();
    const parsed = domainSchema.safeParse(domain);
    if (!parsed.success) return { ok: false, error: "That school could not be found." };
    const result = await setSchoolShortName(admin.id, parsed.data, shortName);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A redirect or "not found" thrown on purpose belongs to the framework.
    unstable_rethrow(error);
    console.error("admin action set-school-short-name failed", error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}
