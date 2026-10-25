"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { claimPerk, redeemVoucher } from "@/lib/perks/voucher";

const GENERIC = "Something went wrong on our side. Try again in a moment.";

export type ClaimResult = { ok: true; voucher: { id: string; code: string; expiresAt: string } } | { ok: false; error: string };
export type RedeemResult = { ok: true; redeemedAt: string } | { ok: false; error: string };

/** Makes (or returns the open) voucher for this perk. */
export async function claimPerkAction(perkId: unknown): Promise<ClaimResult> {
  try {
    const me = await requireActiveStudent();
    const id = z.uuid().safeParse(perkId);
    if (!id.success) return { ok: false, error: "This perk is not available." };
    const result = await claimPerk({ studentId: me.id, perkId: id.data });
    if (!result.ok) return result;
    refresh();
    return { ok: true, voucher: { id: result.voucher.id, code: result.voucher.code, expiresAt: result.voucher.expiresAt.toISOString() } };
  } catch (error) {
    unstable_rethrow(error);
    console.error("claiming a perk failed", error);
    return { ok: false, error: GENERIC };
  }
}

/** The cashier's PIN, typed on the student's phone. */
export async function redeemVoucherAction(voucherId: unknown, pin: unknown): Promise<RedeemResult> {
  try {
    const me = await requireActiveStudent();
    const id = z.uuid().safeParse(voucherId);
    const digits = z.string().regex(/^\d{4}$/).safeParse(pin);
    if (!id.success) return { ok: false, error: "Voucher not found." };
    if (!digits.success) return { ok: false, error: "Enter the 4-digit PIN." };
    const result = await redeemVoucher({ studentId: me.id, voucherId: id.data, pin: digits.data });
    if (!result.ok) return result;
    refresh();
    return { ok: true, redeemedAt: result.redeemedAt.toISOString() };
  } catch (error) {
    unstable_rethrow(error);
    console.error("redeeming a voucher failed", error);
    return { ok: false, error: GENERIC };
  }
}
