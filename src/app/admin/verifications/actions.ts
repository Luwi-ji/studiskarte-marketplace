"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import { getIdStore } from "@/lib/images/store";
import { decideCheck } from "@/lib/verification/service";

type Outcome = { ok: boolean; error?: string };

const idSchema = z.uuid();

/** Approves or rejects one pending ID check. A rejection must carry a reason the member will read. */
export async function decideCheckAction(verificationId: unknown, decision: "approve" | "reject", reason?: unknown): Promise<Outcome> {
  try {
    const admin = await requireAdmin();
    const parsed = idSchema.safeParse(verificationId);
    if (!parsed.success) return { ok: false, error: "That could not be found." };
    const text = typeof reason === "string" ? reason.trim() : "";
    if (decision === "reject" && text === "") return { ok: false, error: "Write a reason. The member will read it." };
    const result = await decideCheck({ adminId: admin.id, verificationId: parsed.data, decision, reason: decision === "reject" ? text : undefined, store: getIdStore() });
    if (result.ok) refresh();
    return result;
  } catch (error) {
    unstable_rethrow(error);
    console.error("admin action decide-check failed", error);
    return { ok: false, error: "Something went wrong on our side. Try again in a moment." };
  }
}
