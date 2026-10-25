"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/access";
import {
  createPartner,
  createPerk,
  newPartnerPin,
  newReportLink,
  setPartnerStatus,
  setPerkStatus,
  updatePartner,
  updatePerk,
  type AdminResult,
} from "@/lib/admin/perks";

const GENERIC = "Something went wrong on our side. Try again in a moment.";
const id = z.uuid();

/** Runs one admin step: admin check, id check, the lib call, a refresh on success, and one error message for anything unexpected. */
async function step<T extends object>(targetId: unknown | undefined, run: (adminId: string, target: string) => Promise<AdminResult<T>>): Promise<AdminResult<T>> {
  try {
    const admin = await requireAdmin();
    let target = "";
    if (targetId !== undefined) {
      const parsed = id.safeParse(targetId);
      if (!parsed.success) return { ok: false, error: "That item could not be found." };
      target = parsed.data;
    }
    const result = await run(admin.id, target);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // A redirect or "not found" thrown on purpose belongs to the framework.
    unstable_rethrow(error);
    console.error("admin perks action failed", error);
    return { ok: false, error: GENERIC };
  }
}

export async function createPartnerAction(raw: unknown) {
  return step(undefined, (admin) => createPartner(admin, raw));
}
export async function createPerkAction(raw: unknown) {
  return step(undefined, (admin) => createPerk(admin, raw));
}
export async function updatePartnerAction(partnerId: unknown, raw: unknown) {
  return step(partnerId, (admin, target) => updatePartner(admin, target, raw));
}
export async function updatePerkAction(perkId: unknown, raw: unknown) {
  return step(perkId, (admin, target) => updatePerk(admin, target, raw));
}
export async function setPartnerStatusAction(partnerId: unknown, status: unknown) {
  return step(partnerId, (admin, target) => setPartnerStatus(admin, target, status));
}
export async function setPerkStatusAction(perkId: unknown, status: unknown) {
  return step(perkId, (admin, target) => setPerkStatus(admin, target, status));
}
export async function newPartnerPinAction(partnerId: unknown) {
  return step(partnerId, (admin, target) => newPartnerPin(admin, target));
}
export async function newReportLinkAction(partnerId: unknown) {
  return step(partnerId, (admin, target) => newReportLink(admin, target));
}
