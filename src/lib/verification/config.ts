/** ID checks: the numbers and the switch. Nothing here is a secret. */

/** The checks open only when the private ID bucket is set. Without it nobody can ask for one and the showcase limit is off. */
export function verificationEnabled(): boolean {
  return Boolean(process.env.R2_ID_BUCKET);
}

/** A check left waiting (or half filled in) this long is closed and its pictures deleted. */
export const OPEN_CHECK_KEEP_DAYS = 7;
/** An approval lasts this long; then the person can check again. */
export const CHECK_VALID_DAYS = 365;
/** After this many rejections the person cannot ask again from the app. */
export const MAX_REJECTED_CHECKS = 3;
/** How long an admin's picture link works (the signing window can add a few minutes). */
export const VIEW_LINK_SECONDS = 60;
/** An unchecked student may have this many open showcase listings. */
export const UNCHECKED_SHOWCASE_MAX = 1;

/** Whether an ID check is in force at `now`. */
export function idCheckIsCurrent(checkedAt: Date | null, expiresAt: Date | null, now: Date = new Date()): boolean {
  return checkedAt !== null && expiresAt !== null && expiresAt.getTime() > now.getTime();
}

export const DOCUMENT_KINDS = ["school_id", "registration", "graduation", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  school_id: "School ID",
  registration: "Certificate of registration",
  graduation: "Proof that you graduated: diploma, certificate of graduation or alumni ID (not a transcript of grades)",
  other: "Another school document",
};

/** What a person may show, by the role they have: graduates show proof of graduation, everyone else a school ID or registration. */
export function documentKindsFor(role: string): readonly DocumentKind[] {
  return role === "alumni" ? ["graduation", "other"] : ["school_id", "registration", "other"];
}
