import { TURN_LABEL, type Turn } from "@/lib/deals/turn";

const STYLE: Record<Turn, string> = {
  mine: "bg-brand text-white",
  theirs: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  none: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

/**
 * Whose move an ongoing transaction is waiting for: "Your turn" or "Waiting for them". With no turn it shows `neutral`
 * (the status in a word, such as "Reserved") in the plain style, or nothing when there is none.
 */
export function TurnChip({ turn, neutral, className = "" }: { turn: Turn; neutral?: string; className?: string }) {
  const label = turn === "none" ? neutral : TURN_LABEL[turn];
  if (!label) return null;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${STYLE[turn]} ${className}`}>{label}</span>;
}
