"use server";

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import { requireActiveStudent } from "@/lib/access";
import { getIdStore } from "@/lib/images/store";
import { alertNewIdCheck } from "@/lib/safety/report-alert";
import { verificationEnabled } from "@/lib/verification/config";
import { NOT_OPEN, startCheck, submitCheck, withdrawConsent } from "@/lib/verification/service";

type Answer = { ok: true } | { ok: false; error: string };

const WENT_WRONG = "Something went wrong on our side. Try again in a moment.";

/** The person ticked the box and chose a document: records the consent and opens a draft. */
export async function startCheckAction(documentKind: unknown, consented: unknown): Promise<Answer> {
  try {
    const me = await requireActiveStudent();
    const result = await startCheck({ studentId: me.id, documentKind, consented: consented === true });
    if (!result.ok) return result;
    refresh();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("start ID check failed", error);
    return { ok: false, error: WENT_WRONG };
  }
}

/** Sends the draft, with both pictures, to the owner. */
export async function submitCheckAction(): Promise<Answer> {
  try {
    const me = await requireActiveStudent();
    const result = await submitCheck(me.id);
    if (!result.ok) return result;
    after(() => alertNewIdCheck());
    refresh();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("submit ID check failed", error);
    return { ok: false, error: WENT_WRONG };
  }
}

/** Takes the consent back at once: no extra confirmation. */
export async function withdrawConsentAction(): Promise<Answer> {
  try {
    const me = await requireActiveStudent();
    if (!verificationEnabled()) return { ok: false, error: NOT_OPEN };
    const result = await withdrawConsent({ studentId: me.id, store: getIdStore(), channel: "settings" });
    if (!result.ok) return result;
    refresh();
    return { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("withdraw ID consent failed", error);
    return { ok: false, error: WENT_WRONG };
  }
}
