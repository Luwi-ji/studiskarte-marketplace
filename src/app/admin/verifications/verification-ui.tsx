import type { ReactNode } from "react";
import { DOCUMENT_LABEL, type DocumentKind } from "@/lib/verification/config";
import type { CheckStatus } from "@/lib/verification/service";

export const STATUS_LABEL: Record<CheckStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  expired: "Expired",
  draft: "Not sent",
};

/** Short names for the document chip; the full wording is in DOCUMENT_LABEL. */
const DOCUMENT_CHIP: Record<DocumentKind, string> = {
  school_id: "School ID",
  registration: "Registration",
  graduation: "Graduation proof",
  other: "Other document",
};

const TONE = {
  plain: "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300",
  brand: "border-brand text-brand-text",
  warn: "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
} as const;

export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: keyof typeof TONE }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-3 text-sm font-medium ${TONE[tone]}`}>{children}</span>;
}

export function DocumentChip({ kind }: { kind: DocumentKind }) {
  return (
    <span title={DOCUMENT_LABEL[kind]}>
      <Chip tone="brand">{DOCUMENT_CHIP[kind]}</Chip>
    </span>
  );
}

/** "5 min", "3 hours", "2 days": how long ago, in the unit that reads best. */
export function ageLabel(from: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 60_000));
  if (minutes < 1) return "under 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${Math.floor(hours / 24)} days`;
}

/** True once a check has waited long enough that the automatic deletion is close (see OPEN_CHECK_KEEP_DAYS). */
export function isOverdue(from: Date, now: Date, keepDays: number): boolean {
  return now.getTime() - from.getTime() >= (keepDays - 2) * 86_400_000;
}
