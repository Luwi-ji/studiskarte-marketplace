/** What a partner sells. Must match the `partner_kind` check in the schema. */
export const PERK_KINDS = [
  { id: "food", label: "Food & drink" },
  { id: "clothes", label: "Clothes" },
  { id: "printing", label: "Printing" },
  { id: "services", label: "Services" },
  { id: "other", label: "Other" },
] as const;

export type PerkKind = (typeof PERK_KINDS)[number]["id"];

export function isPerkKind(value: unknown): value is PerkKind {
  return PERK_KINDS.some((k) => k.id === value);
}

export function perkKindLabel(kind: string): string {
  return PERK_KINDS.find((k) => k.id === kind)?.label ?? "Other";
}

const PERIOD_TEXT: Record<string, string> = { day: "a day", week: "a week", month: "a month", ever: "in total" };

/** "1 use a day per student", or null when there is no limit. */
export function limitLine(limitPerStudent: number | null, limitPeriod: string | null): string | null {
  if (limitPerStudent === null || limitPeriod === null) return null;
  const uses = limitPerStudent === 1 ? "1 use" : `${limitPerStudent} uses`;
  return `${uses} ${PERIOD_TEXT[limitPeriod] ?? limitPeriod} per student`;
}
