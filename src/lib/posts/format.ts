/** "₱1,200", "Free" or "Negotiable". */
export function formatPrice(priceKind: string, priceAmount: number | null): string {
  if (priceKind === "free") return "Free";
  if (priceKind === "amount" && priceAmount !== null) return `₱${priceAmount.toLocaleString("en-PH")}`;
  return "Negotiable";
}

export const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  reserved: "Reserved",
  fulfilled: "Fulfilled",
  withdrawn: "Withdrawn",
  expired: "Expired",
  hidden: "Hidden pending review",
  removed: "Removed",
};
